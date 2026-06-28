const { spawn } = require("child_process");
const path = require("path");

function spawnPythonApi() {
  const pythonPath = path.join(__dirname, "../../../python-api");
  const venvPython = path.join(pythonPath, "venv", "Scripts", "python.exe");

  const proc = spawn(
    venvPython,
    ["-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "5001"],
    {
      cwd: pythonPath,
      stdio: "pipe",
    }
  );

  proc.stdout.on("data", (d) => console.log(`[Python] ${d}`));
  proc.stderr.on("data", (d) => console.log(`[Python ERR] ${d}`));
  proc.on("exit", (code) => console.log(`[Python] exited with code ${code}`));

  console.log("🐍 Python Detection API spawned");
  return proc;
}

module.exports = { spawnPythonApi };