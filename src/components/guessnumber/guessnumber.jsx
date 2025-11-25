import React, { useEffect, useRef, useState } from "react";
import "./guessnumber.css";

export default function ChatGuessGame() {
    const pad4 = (n) => String(n).padStart(4, "0");
    const isValid4 = (s) => /^[0-9]{4}$/.test(s);

    function computeFeedback(secret, guess) {
        let exact = 0;
        const sCount = new Array(10).fill(0);
        const gCount = new Array(10).fill(0);
        for (let i = 0; i < 4; i++) {
            if (secret[i] === guess[i]) exact++;
            else {
                sCount[Number(secret[i])]++;
                gCount[Number(guess[i])]++;
            }
        }
        let misplaced = 0;
        for (let d = 0; d <= 9; d++) misplaced += Math.min(sCount[d], gCount[d]);
        return { exact, misplaced };
    }

    function buildAllCandidates() {
        const a = [];
        for (let i = 0; i < 10000; i++) a.push(pad4(i));
        return a;
    }

    function filterCandidatesArray(candidates, guess, feedback) {
        return candidates.filter((c) => {
            const fb = computeFeedback(c, guess);
            return fb.exact === feedback.exact && fb.misplaced === feedback.misplaced;
        });
    }

    // ---------- state & refs ----------
    const [systemSecret, setSystemSecret] = useState(null);
    const [systemCandidatesState, setSystemCandidatesState] = useState(() => buildAllCandidates());
    const systemCandidatesRef = useRef(buildAllCandidates());
    const systemPreviousGuessesRef = useRef(new Set());

    const [gameActive, setGameActive] = useState(false);
    const [turn, setTurn] = useState(null); // 'system' | 'player'
    const [started, setStarted] = useState(false); // controls Start/Reset label

    const [messages, setMessages] = useState([]);
    const msgIdRef = useRef(1);
    const messagesElRef = useRef(null);
    const inputRef = useRef(null);
    const sendBtnRef = useRef(null);

    // ---------- message helpers ----------
    function appendBot(html) {
        const id = msgIdRef.current++;
        setMessages((m) => [...m, { id, type: "bot", html }]);
        return id;
    }
    function appendUser(text) {
        const id = msgIdRef.current++;
        setMessages((m) => [...m, { id, type: "user", html: text }]);
        return id;
    }
    function appendCenter(html) {
        const id = msgIdRef.current++;
        setMessages((m) => [...m, { id, type: "center", html }]);
        return id;
    }

    useEffect(() => {
        if (messagesElRef.current) {
            messagesElRef.current.scrollTop = messagesElRef.current.scrollHeight;
        }
    }, [messages]);

    // remove data-guess marker so QuickReplies disappears
    function consumeLastBotGuess() {
        setMessages((prev) => {
            const idxRev = [...prev].reverse().findIndex(
                (m) => m.type === "bot" && /data-guess="/.test(m.html)
            );
            if (idxRev === -1) return prev;
            const idx = prev.length - 1 - idxRev;
            const newMessages = prev.slice();
            newMessages[idx] = {
                ...newMessages[idx],
                html: newMessages[idx].html.replace(/\s*data-guess=\"\d{4}\"/, ""),
            };
            return newMessages;
        });
    }

    // system guess (after the first)
    function systemGuessTurn() {
        if (!gameActive) return;

        const remaining = systemCandidatesRef.current.filter(
            (c) => !systemPreviousGuessesRef.current.has(c)
        );
        if (remaining.length === 0) {
            appendBot(
                "I have no candidates left — the feedback seems inconsistent. Please Reset the game."
            );
            return;
        }
        const guess = remaining[Math.floor(Math.random() * remaining.length)];
        systemPreviousGuessesRef.current.add(guess);
        appendBot(
            `<div data-guess="${guess}">I guess: <strong>${guess}</strong></div><div class="meta">Select feedback below</div>`
        );

        if (inputRef.current) inputRef.current.disabled = true;
        if (sendBtnRef.current) sendBtnRef.current.disabled = true;
    }

    // reset UI & game state
    function resetUI() {
        msgIdRef.current = 1;
        setMessages([
            {
                id: msgIdRef.current++,
                type: "center",
                html: 'Ready. Click <strong>Start</strong> to begin. Think of a 4-digit secret (do NOT type it).',
            },
        ]);

        if (inputRef.current) {
            inputRef.current.value = "";
            inputRef.current.disabled = true;
        }
        if (sendBtnRef.current) sendBtnRef.current.disabled = true;

        setSystemSecret(null);
        const all = buildAllCandidates();
        systemCandidatesRef.current = all;
        setSystemCandidatesState(all);
        systemPreviousGuessesRef.current = new Set();

        setGameActive(false);
        setTurn(null);
    }

    // start game; system prepares & makes first guess
    function startGame() {
        setStarted(true);

        const s = pad4(Math.floor(Math.random() * 10000));
        setSystemSecret(s);

        const all = buildAllCandidates();
        systemCandidatesRef.current = all;
        setSystemCandidatesState(all);
        systemPreviousGuessesRef.current = new Set();

        setGameActive(true);
        setTurn("system");

        // choose first guess immediately
        const remainingForFirst = systemCandidatesRef.current.filter(
            (c) => !systemPreviousGuessesRef.current.has(c)
        );
        const firstGuess =
            remainingForFirst[Math.floor(Math.random() * remainingForFirst.length)];
        systemPreviousGuessesRef.current.add(firstGuess);

        const idBot = msgIdRef.current++;
        const idCenter = msgIdRef.current++;
        setMessages([
            {
                id: idBot,
                type: "bot",
                html:
                    "<strong>Hello!</strong> I will start by guessing your 4-digit secret. " +
                    "Use the dropdown below my guess to tell me how close I am.",
            },
            { id: idCenter, type: "center", html: "<em>System is thinking...</em>" },
        ]);

        if (inputRef.current) inputRef.current.disabled = true;
        if (sendBtnRef.current) sendBtnRef.current.disabled = true;

        setTimeout(() => {
            const guessMsgId = msgIdRef.current++;
            setMessages((prev) => {
                const filtered = prev.filter((x) => x.type !== "center");
                return [
                    ...filtered,
                    {
                        id: guessMsgId,
                        type: "bot",
                        html: `<div data-guess="${firstGuess}">I guess: <strong>${firstGuess}</strong></div><div class="meta">Select feedback below</div>`,
                    },
                ];
            });
        }, 800);
    }

    // handle your feedback for system guess
    function handleUserFeedbackForSystem(guess, feedback) {
        consumeLastBotGuess();
        appendUser(`Feedback for ${guess}: ${feedback.exact} exact, ${feedback.misplaced} misplaced`);

        if (feedback.exact === 4) {
            appendBot(
                `<strong>Yay — I guessed it!</strong> Your secret is <strong>${guess}</strong>. I win.`
            );
            endGame(`System wins! My secret was <strong>${systemSecret}</strong>.`);
            return;
        }


        const next = filterCandidatesArray(systemCandidatesRef.current, guess, feedback);
        systemCandidatesRef.current = next;
        setSystemCandidatesState(next);

        appendBot("<div>Ok, now it's your turn. Please type a guess at my secret.</div>");
        setTurn("player");
        if (inputRef.current) {
            inputRef.current.disabled = false;
            inputRef.current.focus();
        }
        if (sendBtnRef.current) sendBtnRef.current.disabled = false;
    }

    // your guess towards systemSecret
    function playerGuessSubmit() {
        if (!gameActive) return;
        if (turn !== "player") {
            alert("Not your turn yet.");
            return;
        }
        const g = inputRef.current?.value.trim() ?? "";
        if (!isValid4(g)) {
            alert("Enter a valid 4-digit guess (0-9 allowed).");
            return;
        }

        appendUser(`I guess: ${g}`);
        if (inputRef.current) inputRef.current.value = "";

        const fb = computeFeedback(systemSecret, g);
        if (fb.exact === 4) {
            appendBot(`<strong>Correct!</strong> You guessed my secret (${systemSecret}). You win!`);
            endGame("Player wins!");
            return;
        } else {
            appendBot(
                `<div>Nope — <strong>${fb.exact} exact</strong>, <strong>${fb.misplaced} misplaced</strong>. My turn to guess now.</div>`
            );
            setTurn("system");
            if (inputRef.current) inputRef.current.disabled = true;
            if (sendBtnRef.current) sendBtnRef.current.disabled = true;
            setTimeout(systemGuessTurn, 600);
        }
    }

    function endGame(msg) {
        setGameActive(false);
        setTurn(null);
        appendCenter(`<strong>${msg}</strong> Click Reset to play again.`);
        if (inputRef.current) inputRef.current.disabled = true;
        if (sendBtnRef.current) sendBtnRef.current.disabled = true;
    }

    // -------------------
    // QuickReplies component
    // -------------------
    function QuickReplies() {
        // local state: "" means "Select feedback" placeholder
        const [value, setValue] = useState("");

        // find last bot message with data-guess
        for (let i = messages.length - 1; i >= 0; i--) {
            const m = messages[i];
            if (m.type === "bot" && m.html.includes('data-guess="')) {
                const match = m.html.match(/data-guess="(\d{4})"/);
                if (!match) return null;
                const guess = match[1];

                // Build option list
                const options = [];
                for (let ex = 0; ex <= 4; ex++) {
                    for (let mp = 0; mp <= 4 - ex; mp++) {
                        options.push({
                            ex,
                            mp,
                            label: `${ex} exact, ${mp} misplaced`,
                            key: `${ex}-${mp}`,
                        });
                    }
                }

                return (
                    <div className="quick-replies-panel" key={`qr-${guess}`}>
                        <div className="qr-left">
                            <label htmlFor={`feedback-select-${guess}`} className="sr-only">
                                Feedback for {guess}
                            </label>
                            <select
                                id={`feedback-select-${guess}`}
                                className="feedback-select"
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                            >
                                <option value="" disabled>
                                    Select feedback
                                </option>
                                {options.map((opt) => (
                                    <option key={opt.key} value={opt.key}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>

                            <button
                                className="feedback-send btn"
                                onClick={() => {
                                    if (!value) return;
                                    const [exS, mpS] = value.split("-");
                                    handleUserFeedbackForSystem(guess, {
                                        exact: Number(exS),
                                        misplaced: Number(mpS),
                                    });
                                }}
                                disabled={!value}
                                aria-disabled={!value}
                                title={!value ? "Choose feedback first" : "Send feedback"}
                            >
                                Send
                            </button>
                        </div>
                    </div>
                );
            }
        }
        return null;
    }

    // mount: show initial "Ready" message
    useEffect(() => {
        resetUI();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="app-wrap">
            <div className="app" role="application" aria-label="Guess the number chat game">
                <div className="header">
                    <div style={{ display: "flex", flexDirection: "column" }}>
                        <div className="title">Guess-The-4-Digit — Chat Bot</div>
                    </div>

                    <div className="controls" style={{ marginLeft: "auto" }}>
                        <button
                            className="btn small"
                            onClick={() => {
                                if (!started) {
                                    startGame();
                                } else {
                                    resetUI();
                                    setStarted(false);
                                }
                            }}
                        >
                            {started ? "Reset" : "Start"}
                        </button>
                    </div>
                </div>

                <div className="chat-area">
                    <div className="messages" ref={messagesElRef}>
                        {messages.map((m) =>
                            m.type === "center" ? (
                                <div key={m.id} className="center" dangerouslySetInnerHTML={{ __html: m.html }} />
                            ) : m.type === "bot" ? (
                                <div key={m.id} className="msg bot">
                                    <div className="avatar">B</div>
                                    <div className="bubble bot" dangerouslySetInnerHTML={{ __html: m.html }} />
                                </div>
                            ) : (
                                <div key={m.id} className="msg user">
                                    <div className="bubble user">{m.html}</div>
                                    <div className="avatar">Y</div>
                                </div>
                            )
                        )}

                        <QuickReplies />
                    </div>
                </div>

                <div className="composer">
                    <div className="text-input">
                        <input
                            ref={inputRef}
                            maxLength="4"
                            placeholder="Type your guess (4 digits)..."
                            onKeyDown={(e) => e.key === "Enter" && playerGuessSubmit()}
                        />
                    </div>
                    <button ref={sendBtnRef} className="btn" onClick={playerGuessSubmit}>
                        Send
                    </button>
                </div>
            </div>
        </div>
    );
}
