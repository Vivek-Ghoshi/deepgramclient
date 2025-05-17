import { useEffect, useRef, useState } from "react";

const App = () => {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  useEffect(() => {
    console.log("📡 Connecting to backend WebSocket...");
    const ws = new WebSocket("wss://deepgramtask.onrender.com");

    ws.onopen = () => {
      console.log("✅ Connected to backend WebSocket");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.text) {
          console.log("📥 Agent text received:", data.text);
          setMessages((prev) => [...prev, { sender: "agent", text: data.text }]);
        }

        if (data.audio) {
          console.log("🔊 Audio received from agent, playing...");
          const audio = new Audio(`data:audio/wav;base64,${data.audio}`);
          audio.play();
        }
      } catch (error) {
        console.error("❌ Failed to parse WebSocket message:", event.data, error);
      }
    };

    ws.onerror = (err) => {
      console.error("⚠️ WebSocket error:", err);
    };

    ws.onclose = () => {
      console.warn("🛑 WebSocket connection closed");
    };

    setSocket(ws);
    return () => ws.close();
  }, []);

  const handleSendText = () => {
    if (userInput.trim() !== "") {
      console.log("📤 Sending user text to backend:", userInput);
      socket.send(JSON.stringify({ userText: userInput }));
      setMessages((prev) => [...prev, { sender: "user", text: userInput }]);
      setUserInput("");
    }
  };

  const toggleRecording = async () => {
    if (!isRecording) {
      try {
        console.log("🎤 Starting microphone access...");
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log("🎙️ Microphone stream started");

        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;

        const context = new AudioContext({ sampleRate: 16000 });
        console.log("🧪 AudioContext created with sample rate:", context.sampleRate);

        await context.audioWorklet.addModule("/pcm-processor.js");
        console.log("✅ PCM processor module loaded");

        const source = context.createMediaStreamSource(stream);
        const pcmNode = new AudioWorkletNode(context, "pcm-processor");

        pcmNode.port.onmessage = (event) => {
          const pcmBuffer = event.data;
          if (socket && socket.readyState === WebSocket.OPEN) {
            console.log("📤 Sending raw PCM buffer of size:", pcmBuffer.byteLength);
            socket.send(pcmBuffer);
          } else {
            console.warn("⚠️ Socket not open when trying to send PCM data");
          }
        };

        source.connect(pcmNode).connect(context.destination);
        console.log("🔗 PCM audio stream pipeline connected");

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            console.log("📦 MediaRecorder chunk available, size:", e.data.size);
            socket.send(e.data);
          }
        };

        mediaRecorder.onstop = () => {
          console.log("🛑 MediaRecorder stopped");
          stream.getTracks().forEach((track) => track.stop());
        };

        mediaRecorder.start(250); // send audio every 250ms
        console.log("▶️ MediaRecorder started with interval: 250ms");
        setIsRecording(true);
      } catch (err) {
        console.error("❌ Error starting recording:", err);
      }
    } else {
      console.log("🛑 Stopping recording...");
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1D3557] via-[#457B9D] to-[#E63946] p-6 flex flex-col items-center text-white">
      <h1 className="text-3xl font-bold mb-4">🧠 Deepgram Voice Agent</h1>

      <div className="w-full max-w-2xl bg-white/10 backdrop-blur-md rounded-xl shadow-xl p-4 h-[70vh] overflow-y-auto space-y-3">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`p-3 rounded-xl max-w-[80%] ${
              msg.sender === "user"
                ? "bg-[#E63946] self-end ml-auto text-right"
                : "bg-[#1D3557] self-start mr-auto text-left"
            }`}
          >
            <p className="text-sm text-white">{msg.text}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 w-full max-w-2xl flex gap-3">
        <input
          type="text"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSendText()}
          className="flex-1 p-3 rounded-lg bg-white/10 text-white placeholder:text-white/70 outline-none"
          placeholder="Type your question..."
        />
        <button
          onClick={handleSendText}
          className="bg-[#1D3557] px-4 py-2 rounded-lg hover:bg-[#16324f] transition"
        >
          Send
        </button>
        <button
          onClick={toggleRecording}
          className={`px-4 py-2 rounded-lg transition ${
            isRecording
              ? "bg-red-600 hover:bg-red-700"
              : "bg-green-600 hover:bg-green-700"
          }`}
        >
          {isRecording ? "Stop 🎙️" : "Speak 🎤"}
        </button>
      </div>
    </div>
  );
};

export default App;
