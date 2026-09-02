/**
 * One-time migration: production SavedPaper docs used `pmcid` only.
 * This backfills primarySource, paperId, and idName for every legacy row.
 *
 * Usage:
 *   node --env-file=.env.local scripts/migrate-saved-papers.mjs
 *
 * Or set MONGODB_URI in your shell first:
 *   MONGODB_URI="..." node scripts/migrate-saved-papers.mjs
 */
import mongoose from "mongoose";

const NIH_LABEL = "NIH PubMed";
const NIH_ID_NAME = "pmcid";

function normalizeStoredPaperId(paperId) {
    const trimmed = paperId.trim();
    const digits = trimmed.replace(/^PMC/i, "").replace(/\D/g, "");
    return digits || trimmed;
}

const savedPaperSchema = new mongoose.Schema(
    {
        pmcid: String,
        primarySource: String,
        paperId: String,
        idName: String,
        userID: mongoose.Schema.Types.ObjectId,
    },
    { timestamps: true, strict: false },
);

const SavedPaper =
    mongoose.models.SavedPaper ||
    mongoose.model("SavedPaper", savedPaperSchema);

async function main() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        throw new Error("MONGODB_URI is required.");
    }

    await mongoose.connect(uri);

    const legacyDocs = await SavedPaper.find({
        pmcid: { $exists: true, $ne: null },
        $or: [
            { primarySource: { $exists: false } },
            { primarySource: null },
            { primarySource: "" },
        ],
    });

    console.log(`Found ${legacyDocs.length} legacy saved paper(s) to migrate.`);

    let migrated = 0;
    for (const doc of legacyDocs) {
        const paperId = normalizeStoredPaperId(doc.pmcid);

        await SavedPaper.updateOne(
            { _id: doc._id },
            {
                $set: {
                    primarySource: NIH_LABEL,
                    paperId,
                    idName: NIH_ID_NAME,
                },
                $unset: { pmcid: "" },
            },
        );

        migrated += 1;
        console.log(`Migrated ${doc._id} (pmcid: ${doc.pmcid} -> paperId: ${paperId})`);
    }

    const remainingLegacy = await SavedPaper.countDocuments({
        pmcid: { $exists: true, $ne: null },
    });

    console.log(`Done. Migrated ${migrated} document(s).`);
    console.log(`Remaining legacy pmcid documents: ${remainingLegacy}`);

    await mongoose.disconnect();
}

main().catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
});
