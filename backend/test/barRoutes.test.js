
const test = require("node:test");
const assert = require("node:assert");
const app = require("../src/app");

test("Bar: Unauthenticated GET bar items request is rejected", async () => {
  const server = app.listen(0);
  const { port } = server.address();

  try {
    const response = await fetch(
      `http://127.0.0.1:${port}/api/bar-items`
    );

    assert.strictEqual(response.status, 401);

    const body = await response.json();
    assert.strictEqual(body.code, "UNAUTHENTICATED");
  } finally {
    server.close();
  }
});

test("Bar: Unauthenticated GET bar orders request is rejected", async () => {
  const server = app.listen(0);
  const { port } = server.address();

  try {
    const response = await fetch(
      `http://127.0.0.1:${port}/api/bar-orders`
    );

    assert.strictEqual(response.status, 401);

    const body = await response.json();
    assert.strictEqual(body.code, "UNAUTHENTICATED");
  } finally {
    server.close();
  }
});

test("Bar: Unauthenticated POST bar order request is rejected", async () => {
  const server = app.listen(0);
  const { port } = server.address();

  try {
    const response = await fetch(
      `http://127.0.0.1:${port}/api/bar-orders`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reservationId: 1,
          barItemId: 1,
          quantity: 2,
        }),
      }
    );

    assert.strictEqual(response.status, 401);

    const body = await response.json();
    assert.strictEqual(body.code, "UNAUTHENTICATED");
  } finally {
    server.close();
  }
});
