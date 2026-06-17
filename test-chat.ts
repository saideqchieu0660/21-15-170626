import fetch from 'node-fetch';

async function test() {
    const res = await fetch("http://localhost:3000/api/agent3/chat", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-user-id": "test-user",
            "x-user-role": "student"
        },
        body: JSON.stringify({
            message: "Photosynthesis là gì",
            sessionId: "12345",
            mode: "chat"
        })
    });
    const text = await res.text();
    console.log("Status:", res.status);
    console.log("Response:", text);
}
test();
