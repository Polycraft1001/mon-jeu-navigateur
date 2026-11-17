const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const TILE = 20;
const N = canvas.width / TILE;

let snake, dir, food, score;

function randomCell() {
  return { x: Math.floor(Math.random() * N), y: Math.floor(Math.random() * N) };
}

function reset() {
  snake = [{ x: 10, y: 10 }];
  dir = { x: 1, y: 0 };
  food = randomCell();
  score = 0;
}

document.addEventListener("keydown", (e) => {
  const d = {
    ArrowUp: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
  }[e.key];
  if (d && (d.x !== -dir.x || d.y !== -dir.y)) {
    dir = d;
    e.preventDefault();
  }
});

function loop() {
  const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
  const hitWall = head.x < 0 || head.y < 0 || head.x >= N || head.y >= N;
  const hitSelf = snake.some((s) => s.x === head.x && s.y === head.y);

  if (hitWall || hitSelf) {
    alert("Perdu ! Score : " + score);
    reset();
  } else {
    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
      score++;
      food = randomCell();
    } else {
      snake.pop();
    }
  }

  document.getElementById("score").textContent = score;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "red";
  ctx.fillRect(food.x * TILE, food.y * TILE, TILE, TILE);
  ctx.fillStyle = "lime";
  snake.forEach((s) => ctx.fillRect(s.x * TILE, s.y * TILE, TILE - 1, TILE - 1));
}

reset();
setInterval(loop, 120);
