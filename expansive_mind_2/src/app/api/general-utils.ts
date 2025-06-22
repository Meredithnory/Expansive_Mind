const MONTH_NAMES: Record<string, string> = {
    1: "Jan",
    2: "Feb",
    3: "Mar",
    4: "Apr",
    5: "May",
    6: "Jun",
    7: "Jul",
    8: "Aug",
    9: "Sep",
    10: "Oct",
    11: "Nov",
    12: "Dec",
};
export const convertMonthToName = (monthNum: string): string => {
    const name = MONTH_NAMES[monthNum];

    if (!name) {
        return String(monthNum);
    }

    return name;
};
