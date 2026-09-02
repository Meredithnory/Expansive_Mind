export function sessionVersion(value: unknown) {
    return Number.isSafeInteger(value) && Number(value) >= 0
        ? Number(value)
        : 0;
}

export function sessionVersionMatches(
    tokenValue: unknown,
    userValue: unknown,
) {
    return sessionVersion(tokenValue) === sessionVersion(userValue);
}
