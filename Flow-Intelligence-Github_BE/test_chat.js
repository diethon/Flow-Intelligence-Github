// using native fetch

async function test() {
  const res = await fetch('http://localhost:3001/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      repositoryId: "6a5cd3282853e86565be76bc",
      message: "hello",
      conversationHistory: []
    })
  });
  const data = await res.text();
  console.log("Status:", res.status);
  console.log("Body:", data);
}
test();
