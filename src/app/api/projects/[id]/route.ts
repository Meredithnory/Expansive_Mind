import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { withAuth } from "../../authMiddleware";
import { hasValidMutationOrigin } from "../../../lib/request-security";
import Project from "../../../models/Project";
import {
    NOTES_MAX,
    STEP_STATUSES,
    TITLE_MAX,
    serializeProject,
    type ProjectStepStatus,
} from "../serialize";

type RouteContext = { params: Promise<{ id: string }> };

function asTrimmedString(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

async function loadOwnedProject(userID: unknown, id: string) {
    if (!mongoose.isValidObjectId(id)) return null;
    return Project.findOne({ _id: id, userID });
}

export async function GET(request: NextRequest, context: RouteContext) {
    return withAuth(async (req) => {
        try {
            const { id } = await context.params;
            const project = await loadOwnedProject(req.user._id, id);
            if (!project) {
                return NextResponse.json(
                    { error: "Project not found." },
                    { status: 404 },
                );
            }
            return NextResponse.json(
                { project: serializeProject(project.toObject() as any) },
                { headers: { "Cache-Control": "private, no-store" } },
            );
        } catch (error) {
            console.error("Get project request failed", error);
            return NextResponse.json(
                { error: "Unable to load this project." },
                { status: 500 },
            );
        }
    })(request);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
    return withAuth(async (req) => {
        try {
            if (!hasValidMutationOrigin(req)) {
                return NextResponse.json(
                    { error: "Invalid origin." },
                    { status: 403 },
                );
            }

            const { id } = await context.params;
            const project = await loadOwnedProject(req.user._id, id);
            if (!project) {
                return NextResponse.json(
                    { error: "Project not found." },
                    { status: 404 },
                );
            }

            const data = await req.json().catch(() => null);
            if (!data || typeof data !== "object") {
                return NextResponse.json(
                    { error: "A valid update is required." },
                    { status: 400 },
                );
            }

            const body = data as Record<string, unknown>;
            let changed = false;

            if ("stepIndex" in body || "status" in body) {
                const stepIndex = body.stepIndex;
                const status = body.status;
                if (
                    !Number.isInteger(stepIndex) ||
                    (stepIndex as number) < 0 ||
                    (stepIndex as number) >= project.plan.length
                ) {
                    return NextResponse.json(
                        { error: "A valid stepIndex is required." },
                        { status: 400 },
                    );
                }
                if (
                    typeof status !== "string" ||
                    !STEP_STATUSES.includes(status as ProjectStepStatus)
                ) {
                    return NextResponse.json(
                        {
                            error: "status must be pending, in-progress, or done.",
                        },
                        { status: 400 },
                    );
                }
                project.plan[stepIndex as number].status =
                    status as ProjectStepStatus;
                changed = true;
            }

            if ("notes" in body) {
                if (typeof body.notes !== "string") {
                    return NextResponse.json(
                        { error: "notes must be a string." },
                        { status: 400 },
                    );
                }
                if (body.notes.length > NOTES_MAX) {
                    return NextResponse.json(
                        {
                            error: `notes must be ${NOTES_MAX} characters or fewer.`,
                        },
                        { status: 400 },
                    );
                }
                project.notes = body.notes;
                changed = true;
            }

            if ("title" in body) {
                const title = asTrimmedString(body.title);
                if (!title || title.length > TITLE_MAX) {
                    return NextResponse.json(
                        {
                            error: `A title of 1–${TITLE_MAX} characters is required.`,
                        },
                        { status: 400 },
                    );
                }
                project.title = title;
                changed = true;
            }

            if (!changed) {
                return NextResponse.json(
                    {
                        error: "Provide stepIndex and status, notes, or title.",
                    },
                    { status: 400 },
                );
            }

            await project.save();
            return NextResponse.json(
                { project: serializeProject(project.toObject() as any) },
                { headers: { "Cache-Control": "private, no-store" } },
            );
        } catch (error) {
            console.error("Update project request failed", error);
            return NextResponse.json(
                { error: "Unable to update this project." },
                { status: 500 },
            );
        }
    })(request);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
    return withAuth(async (req) => {
        try {
            if (!hasValidMutationOrigin(req)) {
                return NextResponse.json(
                    { error: "Invalid origin." },
                    { status: 403 },
                );
            }

            const { id } = await context.params;
            if (!mongoose.isValidObjectId(id)) {
                return NextResponse.json(
                    { error: "A valid project ID is required." },
                    { status: 400 },
                );
            }

            const deleted = await Project.findOneAndDelete({
                _id: id,
                userID: req.user._id,
            });
            if (!deleted) {
                return NextResponse.json(
                    { error: "Project not found." },
                    { status: 404 },
                );
            }

            return NextResponse.json(
                { success: true },
                { headers: { "Cache-Control": "private, no-store" } },
            );
        } catch (error) {
            console.error("Delete project request failed", error);
            return NextResponse.json(
                { error: "Unable to delete this project." },
                { status: 500 },
            );
        }
    })(request);
}
