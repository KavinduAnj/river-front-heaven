
const test = require("node:test");
const assert = require("node:assert");
const app = require("../src/app");

test("F&B Orders: Unauthenticated GET request is rejected", async () => {
  const server = app.listen(0);
  const { port } = server.address();

  try {
    const response = await fetch(
      `http://127.0.0.1:${port}/api/fnb-orders`
    );

    assert.strictEqual(response.status, 401);

    const body = await response.json();
    assert.strictEqual(body.code, "UNAUTHENTICATED");
  } finally {
    server.close();
  }
});

test("F&B Orders: Unauthenticated POST request is rejected", async () => {
  const server = app.listen(0);
  const { port } = server.address();

  try {
    const response = await fetch(
      `http://127.0.0.1:${port}/api/fnb-orders`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reservationId: 1,
          items: [
            {
              menuItemId: 1,
              quantity: 2,
            },
          ],
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
