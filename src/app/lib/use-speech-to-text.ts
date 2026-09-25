"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
    MAX_VOICE_SECONDS,
    MIN_VOICE_MS,
    audioFormatFromMime,
    isLikelyEmptyTranscript,
    speechErrorMessage,
} from "./speech-to-text";

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

function canRecordAudio() {
    return (
        typeof window !== "undefined" &&
        typeof MediaRecorder !== "undefined" &&
        !!navigator.mediaDevices?.getUserMedia
    );
}

/** Chrome and Safari can do live speech; Chromium embeds usually cannot. */
function likelyUsableBrowserSpeech() {
    if (!getSpeechRecognitionCtor() || typeof navigator === "undefined") return false;
    const ua = navigator.userAgent;
    if (/Electron|Cursor\/|Edg\/|OPR\/|Brave/i.test(ua)) return false;
    if (/Safari/i.test(ua) && !/Chrome|Chromium|Android/i.test(ua)) return true;
    return (
        navigator.vendor === "Google Inc." &&
        /Chrome\//.test(ua) &&
        !/Chromium/i.test(ua)
    );
}

function bytesToBase64(bytes: Uint8Array) {
    let binary = "";
    const chunk = 0x8000;
    for (let index = 0; index < bytes.length; index += chunk) {
        binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
    }
    return btoa(binary);
}

function pickRecorderMime() {
    const types = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg;codecs=opus",
    ];
    return types.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
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
    const [transcribing, setTranscribing] = useState(false);
    const [mode, setMode] = useState<"browser" | "recorder">("browser");
    const [error, setError] = useState("");
    const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const discardRef = useRef(false);
    const sessionRef = useRef(0);
    const timeoutRef = useRef<number>(0);
    const startedAtRef = useRef(0);
    const onFinalRef = useRef(onFinal);
    onFinalRef.current = onFinal;

    useEffect(() => {
        setSupported(Boolean(getSpeechRecognitionCtor()) || canRecordAudio());
    }, []);

    const clearTimer = () => {
        if (timeoutRef.current) {
            window.clearTimeout(timeoutRef.current);
            timeoutRef.current = 0;
        }
    };

    const releaseStream = () => {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
    };

    const transcribeRecording = useCallback(async (blob: Blob, session: number) => {
        if (blob.size < 800) {
            if (session === sessionRef.current) {
                setError("No speech was captured. Try again.");
            }
            return;
        }
        if (session === sessionRef.current) setTranscribing(true);
        try {
            const bytes = new Uint8Array(await blob.arrayBuffer());
            const response = await fetch("/api/transcribe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    audio: bytesToBase64(bytes),
                    format: audioFormatFromMime(blob.type),
                    language:
                        typeof navigator !== "undefined"
                            ? navigator.language.slice(0, 2)
                            : "en",
                }),
            });
            const data = (await response.json().catch(() => ({}))) as {
                text?: string;
                error?: string;
            };
            if (session !== sessionRef.current) return;
            if (!response.ok || typeof data.text !== "string") {
                setError(data.error || "Voice input could not be transcribed.");
                return;
            }
            const text = data.text.trim();
            if (!text || isLikelyEmptyTranscript(text)) {
                setError("No speech was captured. Try again.");
                return;
            }
            setError("");
            onFinalRef.current(text);
        } catch {
            if (session === sessionRef.current) {
                setError("Voice input could not be transcribed.");
            }
        } finally {
            if (session === sessionRef.current) setTranscribing(false);
        }
    }, []);

    const stopRecorder = useCallback((opts?: { discard?: boolean }) => {
        const recorder = recorderRef.current;
        discardRef.current = Boolean(opts?.discard);
        clearTimer();
        if (!recorder || recorder.state === "inactive") {
            releaseStream();
            recorderRef.current = null;
            setListening(false);
            return;
        }
        recorder.stop();
    }, []);

    const stopRecognition = useCallback(() => {
        const recognition = recognitionRef.current;
        recognitionRef.current = null;
        recognition?.stop();
    }, []);

    const stop = useCallback(() => {
        stopRecognition();
        stopRecorder();
        setListening(false);
    }, [stopRecognition, stopRecorder]);

    const startRecorder = useCallback(async () => {
        if (!canRecordAudio()) {
            setError("Voice input isn’t available in this browser.");
            return;
        }
        stopRecognition();
        stopRecorder({ discard: true });
        setError("");
        setMode("recorder");
        const session = ++sessionRef.current;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true },
            });
            if (session !== sessionRef.current) {
                stream.getTracks().forEach((track) => track.stop());
                return;
            }
            const mimeType = pickRecorderMime();
            const recorder = new MediaRecorder(
                stream,
                mimeType ? { mimeType } : undefined,
            );
            chunksRef.current = [];
            discardRef.current = false;
            recorder.ondataavailable = (event) => {
                if (event.data.size) chunksRef.current.push(event.data);
            };
            recorder.onerror = () => {
                if (session !== sessionRef.current) return;
                setError("Voice input stopped unexpectedly.");
                setListening(false);
                releaseStream();
            };
            recorder.onstop = () => {
                const chunks = chunksRef.current;
                chunksRef.current = [];
                recorderRef.current = null;
                releaseStream();
                setListening(false);
                const shouldDiscard = discardRef.current;
                discardRef.current = false;
                if (shouldDiscard || session !== sessionRef.current) return;
                if (Date.now() - startedAtRef.current < MIN_VOICE_MS) {
                    setError("No speech was captured. Try again.");
                    return;
                }
                const blob = new Blob(chunks, {
                    type: recorder.mimeType || mimeType || "audio/webm",
                });
                void transcribeRecording(blob, session);
            };
            streamRef.current = stream;
            recorderRef.current = recorder;
            startedAtRef.current = Date.now();
            recorder.start();
            setListening(true);
            timeoutRef.current = window.setTimeout(() => {
                if (recorderRef.current === recorder) stopRecorder();
            }, MAX_VOICE_SECONDS * 1000);
        } catch (cause) {
            const name = cause instanceof DOMException ? cause.name : "";
            setError(
                name === "NotAllowedError" || name === "SecurityError"
                    ? "Microphone access was blocked."
                    : name === "NotFoundError"
                      ? "No microphone was found."
                      : "Voice input could not start.",
            );
            setListening(false);
        }
    }, [stopRecognition, stopRecorder, transcribeRecording]);

    const startRecognition = useCallback(() => {
        const Ctor = getSpeechRecognitionCtor();
        if (!Ctor) {
            void startRecorder();
            return;
        }
        stop();
        setError("");
        setMode("browser");
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
            if (recognitionRef.current !== recognition) return;
            if (event.error === "aborted" || event.error === "no-speech") return;
            if (
                (event.error === "network" ||
                    event.error === "service-not-allowed") &&
                canRecordAudio()
            ) {
                recognitionRef.current = null;
                void startRecorder();
                return;
            }
            const message = speechErrorMessage(event.error);
            if (message) setError(message);
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
            if (canRecordAudio()) {
                void startRecorder();
                return;
            }
            setError("Voice input could not start.");
        }
    }, [startRecorder, stop]);

    const start = useCallback(() => {
        if (!enabled) return;
        if (likelyUsableBrowserSpeech()) {
            startRecognition();
            return;
        }
        void startRecorder();
    }, [enabled, startRecognition, startRecorder]);

    const toggle = useCallback(() => {
        if (transcribing) return;
        if (listening) {
            stop();
            return;
        }
        start();
    }, [listening, start, stop, transcribing]);

    useEffect(() => () => {
        sessionRef.current += 1;
        stopRecognition();
        stopRecorder({ discard: true });
        clearTimer();
        releaseStream();
    }, [stopRecognition, stopRecorder]);

    useEffect(() => {
        if (!enabled && (listening || transcribing)) {
            sessionRef.current += 1;
            stopRecorder({ discard: true });
            stopRecognition();
            setListening(false);
            setTranscribing(false);
        }
    }, [enabled, listening, stopRecognition, stopRecorder, transcribing]);

    return { supported, listening, transcribing, mode, error, start, stop, toggle };
}
