import { NextRequest, NextResponse } from "next/server";
import { withAdmin } from "../../../lib/admin";
import connectDB from "../../../db/connectDB";
import {
    LIVE_WINDOW_MS,
    feedText,
    guestName,
    liveVisitors,
    parseFeedHours,
    parsePersonRef,
    type FeedItem,
    type PresenceRow,
    type ViewRow,
} from "../../../lib/activity";
import { audienceLabel } from "../../../lib/audience";
import { resolvePlan } from "../../../lib/plan-config";
import type { RatingScore } from "../../../lib/rating";
import ActivityEvent from "../../../models/ActivityEvent";
import PageEngagement from "../../../models/PageEngagement";
import Rating from "../../../models/Rating";
import SavedDiscovery from "../../../models/SavedDiscovery";
import User from "../../../models/User";

const HOUR_MS = 60 * 60 * 1_000;
const FEED_LIMIT = 150;

type EventRow = ViewRow & { _id: unknown; kind: string; detail?: string };
type RatingRow = {
    _id: unknown;
    visitorKey: string;
    userID?: unknown;
    score: RatingScore;
    surface: string;
    context?: string;
    comment?: string;
    createdAt: Date;
};
type Account = {
    _id: unknown;
    firstName?: string;
    lastName?: string;
    email?: string;
    plan?: string;
    accessOverride?: string | null;
    subscriptionStatus?: string;
};

/** Who is on the site now, and the latest steps people took. */
export const GET = withAdmin(async (request: NextRequest) => {
    await connectDB();
    const params = request.nextUrl.searchParams;
    const hours = parseFeedHours(params.get("hours"));
    const person = parsePersonRef(params.get("person"));
    const actionsOnly = params.get("actions") === "1";
    const now = new Date();
    const since = new Date(now.getTime() - hours * HOUR_MS);
    const liveSince = new Date(now.getTime() - LIVE_WINDOW_MS);

    // One person's steps include what they did as a guest before signing in.
    const personKeys =
        person?.type === "user"
            ? await PageEngagement.distinct("visitorKey", { userID: person.id })
            : person?.type === "guest"
              ? [person.key]
              : [];
    const who = person
        ? {
              $or: [
                  ...(person.type === "user" ? [{ userID: person.id }] : []),
                  ...(personKeys.length ? [{ visitorKey: { $in: personKeys } }] : []),
              ],
          }
        : {};
    const accountSteps = person?.type !== "guest";
    const userFilter = person?.type === "user" ? person.id : null;

    const [presence, views, events, ratings, shares, signups] = await Promise.all([
        PageEngagement.find({ lastSeenAt: { $gte: liveSince } })
            .select("visitorKey userID lastSeenAt lastPage away secondsByPage")
            .lean<PresenceRow[]>(),
        ActivityEvent.find({ kind: "page_view", at: { $gte: liveSince } })
            .sort({ at: -1 })
            .select("visitorKey userID at page path")
            .lean<ViewRow[]>(),
        ActivityEvent.find({
            at: { $gte: since },
            ...(actionsOnly ? { kind: { $ne: "page_view" } } : {}),
            ...who,
        })
            .sort({ at: -1 })
            .limit(FEED_LIMIT)
            .lean<EventRow[]>(),
        Rating.find({ createdAt: { $gte: since }, ...who })
            .sort({ createdAt: -1 })
            .limit(FEED_LIMIT)
            .lean<RatingRow[]>(),
        accountSteps
            ? SavedDiscovery.find({
                  sharedAt: { $gte: since },
                  ...(userFilter ? { userID: userFilter } : {}),
              })
                  .sort({ sharedAt: -1 })
                  .limit(FEED_LIMIT)
                  .select("userID question sharedAt shareSlug")
                  .lean<Array<{ _id: unknown; userID: unknown; question: string; sharedAt: Date; shareSlug?: string }>>()
            : [],
        accountSteps
            ? User.find({
                  submittedAt: { $gte: since },
                  ...(userFilter ? { _id: userFilter } : {}),
              })
                  .sort({ submittedAt: -1 })
                  .limit(FEED_LIMIT)
                  .select("_id submittedAt signupSource")
                  .lean<Array<{ _id: unknown; submittedAt: Date; signupSource?: string }>>()
            : [],
    ]);

    const live = liveVisitors(presence, views, now.getTime());

    // Name everyone once: a guest who later signed in shows as the account.
    const guestKeys = [
        ...new Set([
            ...live.filter((row) => !row.userID).map((row) => row.visitorKey),
            ...events.filter((row) => !row.userID).map((row) => row.visitorKey),
            ...ratings.filter((row) => !row.userID).map((row) => row.visitorKey),
        ]),
    ];
    const links = guestKeys.length
        ? await PageEngagement.find({ visitorKey: { $in: guestKeys }, userID: { $exists: true } })
              .select("visitorKey userID")
              .lean<Array<{ visitorKey: string; userID: unknown }>>()
        : [];
    const userByKey = new Map(links.map((row) => [row.visitorKey, String(row.userID)]));
    const userIds = [
        ...new Set(
            [
                ...live.map((row) => row.userID),
                ...events.map((row) => row.userID),
                ...ratings.map((row) => row.userID),
                ...shares.map((row) => row.userID),
                ...signups.map((row) => row._id),
                ...userByKey.values(),
                person?.type === "user" ? person.id : null,
            ]
                .filter(Boolean)
                .map(String),
        ),
    ];
    const accounts = userIds.length
        ? await User.find({ _id: { $in: userIds } })
              .select("firstName lastName email plan accessOverride subscriptionStatus")
              .lean<Account[]>()
        : [];
    const accountById = new Map(accounts.map((account) => [String(account._id), account]));

    const identify = (visitorKey?: string | null, userID?: unknown) => {
        const id = userID ? String(userID) : visitorKey ? userByKey.get(visitorKey) : undefined;
        const account = id ? accountById.get(id) : undefined;
        if (id && account) {
            return {
                person: `user:${id}`,
                who: [account.firstName, account.lastName].filter(Boolean).join(" ") || account.email || "Account",
                plan: resolvePlan({ ...account, accessOverride: account.accessOverride ?? undefined }),
            };
        }
        return {
            person: visitorKey ? `guest:${visitorKey}` : "",
            who: visitorKey ? guestName(visitorKey) : "Unknown",
            plan: "guest",
        };
    };

    const feed: FeedItem[] = [
        ...events.map((row) => ({
            id: `event:${String(row._id)}`,
            at: new Date(row.at).toISOString(),
            kind: row.kind as FeedItem["kind"],
            ...identify(row.visitorKey, row.userID),
            text: feedText(row.kind as FeedItem["kind"], row.page),
            ...(row.detail ? { detail: row.detail } : {}),
            ...(row.path ? { path: row.path } : {}),
        })),
        ...ratings.map((row) => ({
            id: `rating:${String(row._id)}`,
            at: new Date(row.createdAt).toISOString(),
            kind: "rating" as const,
            ...identify(row.visitorKey, row.userID),
            text: feedText("rating", null, row.score),
            score: row.score,
            ...(row.comment ? { detail: row.comment } : {}),
            ...(row.context ? { context: row.context } : {}),
        })),
        ...shares.map((row) => ({
            id: `share:${String(row._id)}`,
            at: new Date(row.sharedAt).toISOString(),
            kind: "share" as const,
            ...identify(null, row.userID),
            text: feedText("share"),
            detail: row.question,
            ...(row.shareSlug ? { path: `/brief/${row.shareSlug}` } : {}),
        })),
        ...signups.map((row) => ({
            id: `signup:${String(row._id)}`,
            at: new Date(row.submittedAt).toISOString(),
            kind: "signup" as const,
            ...identify(null, row._id),
            text: feedText("signup"),
            ...(row.signupSource === "brief" ? { detail: "From a shared brief" } : {}),
        })),
    ]
        .sort((a, b) => b.at.localeCompare(a.at))
        .slice(0, FEED_LIMIT);

    return NextResponse.json(
        {
            now: now.toISOString(),
            hours,
            live: live.map((row) => ({
                ...identify(row.visitorKey, row.userID),
                page: row.page,
                pageLabel: audienceLabel(row.page),
                path: row.path,
                lastSeenAt: row.lastSeenAt,
                secondsToday: row.secondsToday,
            })),
            feed,
            personName: person
                ? person.type === "user"
                    ? identify(null, person.id).who
                    : identify(person.key).who
                : null,
        },
        { headers: { "Cache-Control": "private, no-store" } },
    );
});
