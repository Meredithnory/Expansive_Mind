import { NextRequest, NextResponse } from "next/server";
//Get the req from Springer
export const GET = async (req: NextRequest) => {
    const searchQuery = req.nextUrl.searchParams.get("q");
    const apiKey = process.env.SPRINGER_API_KEY;

    if (!searchQuery) {
        return NextResponse.json(
            { error: "Missing search query parameter 'q'" },
            { status: 400 },
        );
    }
    if (!apiKey) {
        return NextResponse.json(
            { error: "Missing Springer API key" },
            { status: 500 },
        );
    }

    try {
        const response = await fetch(
            `https://api.springernature.com/openaccess/json?api_key=${apiKey}&q=keyword:${encodeURIComponent(
                searchQuery,
            )}`,
        );

        if (!response.ok) {
            throw new Error("Failed to fetch data from Springer API");
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (err: any) {
        console.log("Error fetching from Springer Nature data:", err.message);

        return NextResponse.json(
            { error: "Failed to fetch data from Springer Nature data" },
            { status: 500 },
        );
    }
};
