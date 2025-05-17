import { useEffect, useRef, useState } from "react";

const App = () => {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  

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
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      console.warn("⏳ Waiting for WebSocket to open...");
      const waitForSocket = () =>
        new Promise((resolve) => {
          const checkSocketReady = () => {
            if (socket.readyState === WebSocket.OPEN) {
              resolve();
            } else {
              setTimeout(checkSocketReady, 100);
            }
          };
          checkSocketReady();
        });
      await waitForSocket();
      console.log("✅ WebSocket is now open, starting recording...");
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      const context = new AudioContext({ sampleRate: 16000 });
      await context.audioWorklet.addModule("/pcm-processor.js");

      const source = context.createMediaStreamSource(stream);
      const pcmNode = new AudioWorkletNode(context, "pcm-processor");

      pcmNode.port.onmessage = (event) => {
        const pcmBuffer = event.data;
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(pcmBuffer);
        } else {
          console.warn("⚠️ Socket not open when trying to send PCM data");
        }
      };

      source.connect(pcmNode).connect(context.destination);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0 && socket.readyState === WebSocket.OPEN) {
          socket.send(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(250);
      setIsRecording(true);
    } catch (err) {
      console.error("❌ Error starting recording:", err);
    }
  } else {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }
};


  return (
    <div className="w-screen h-screen bg-black p-12 flex items-center justify-center">
    <div className="rounded-xl h-[40vw] w-[45vw] bg-gradient-to-br from-[#1D3557] via-[#457B9D] to-[#E63946] p-6 flex flex-col items-center text-white shadow-lg shadow-white">
      <h1 className="text-3xl font-bold mb-4 text-yellow-400">DeepBuddy...</h1>

      <div className="chat w-full max-w-2xl bg-white/10 backdrop-blur-md rounded-xl shadow-xl p-4 h-[70vh] overflow-y-auto space-y-3 scrollbar-none">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`p-3 rounded-xl w-fit max-w-[80%] ${
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
    </div>
  );
};

export default App;
