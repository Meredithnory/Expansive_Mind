"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SpeechResultLike = {
    isFinal: boolean;
    0: { transcript: string };
};

type SpeechRecognitionLike = {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start: () => void;
    stop: () => void;
    abort: () => void;
    onresult: ((event: { resultIndex: number; results: ArrayLike<SpeechResultLike> }) => void) | null;
    onerror: ((event: { error?: string }) => void) | null;
    onend: (() => void) | null;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

export function finalSpeechTranscripts(
    results: ArrayLike<SpeechResultLike>,
    fromIndex = 0,
): string[] {
    const transcripts: string[] = [];
    for (let index = fromIndex; index < results.length; index += 1) {
        const result = results[index];
        const transcript = result?.[0]?.transcript?.trim();
        if (result?.isFinal && transcript) transcripts.push(transcript);
    }
    return transcripts;
}

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
    if (typeof window === "undefined") return null;
    const speechWindow = window as Window & {
        SpeechRecognition?: SpeechRecognitionCtor;
        webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition || null;
}

export function useSpeechToText({
    enabled = true,
    onFinal,
}: {
    enabled?: boolean;
    onFinal: (transcript: string) => void;
}) {
    const [supported, setSupported] = useState(false);
    const [listening, setListening] = useState(false);
    const [error, setError] = useState("");
    const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
    const onFinalRef = useRef(onFinal);
    onFinalRef.current = onFinal;

    useEffect(() => {
        setSupported(Boolean(getSpeechRecognitionCtor()));
    }, []);

    const stop = useCallback(() => {
        const recognition = recognitionRef.current;
        recognitionRef.current = null;
        setListening(false);
        recognition?.stop();
    }, []);

    const start = useCallback(() => {
        const Ctor = getSpeechRecognitionCtor();
        if (!enabled || !Ctor) {
            setSupported(false);
            return;
        }
        stop();
        setError("");
        const recognition = new Ctor();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang =
            typeof navigator !== "undefined" && navigator.language
                ? navigator.language
                : "en-US";
        recognition.onresult = (event) => {
            for (const transcript of finalSpeechTranscripts(
                event.results,
                event.resultIndex,
            )) {
                onFinalRef.current(transcript);
            }
        };
        recognition.onerror = (event) => {
            if (event.error === "aborted" || event.error === "no-speech") return;
            setError(
                event.error === "not-allowed"
                    ? "Microphone access was blocked."
                    : "Voice input stopped unexpectedly.",
            );
            setListening(false);
        };
        recognition.onend = () => {
            if (recognitionRef.current === recognition) {
                recognitionRef.current = null;
                setListening(false);
            }
        };
        recognitionRef.current = recognition;
        try {
            recognition.start();
            setListening(true);
        } catch {
            recognitionRef.current = null;
            setError("Voice input could not start.");
        }
    }, [enabled, stop]);

    const toggle = useCallback(() => {
        if (listening) {
            stop();
            return;
        }
        start();
    }, [listening, start, stop]);

    useEffect(() => () => stop(), [stop]);

    useEffect(() => {
        if (!enabled && listening) stop();
    }, [enabled, listening, stop]);

    return { supported, listening, error, start, stop, toggle };
}
