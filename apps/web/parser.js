import fs from "fs";

let txt = fs.readFileSync("check.json", "utf8");
txt = txt.replace(
  /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
  "",
);

const lines = txt.split("\n");
const jsonLines = [];
let inJson = false;

// The JSON output of svelte-check --output json should be a JSON array.
for (const line of lines) {
  if (!inJson && (line.startsWith("[") || line.trim().startsWith("["))) {
    inJson = true;
  }
  if (inJson) {
    jsonLines.push(line);
  }
}

let jsonStr = jsonLines.join("\n").trim();
// if the string ends with some non json stuff, find the last ]
const lastBracket = jsonStr.lastIndexOf("]");
if (lastBracket !== -1) {
  jsonStr = jsonStr.slice(0, lastBracket + 1);
}

try {
  const data = JSON.parse(jsonStr);
  const allDiags = [];
  for (const d of data) {
    if (d.diagnostics) {
      allDiags.push(
        ...d.diagnostics
          .filter((x) => x.severity === 1 || x.severity === "error")
          .map((x) => ({ file: d.filename, msg: x.message })),
      );
    }
  }

  const msgCounts = {};
  for (const d of allDiags) {
    msgCounts[d.msg] = (msgCounts[d.msg] || 0) + 1;
  }

  console.log("Total errors:", allDiags.length);
  Object.entries(msgCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach((x) => console.log(x[1] + "x: " + x[0]));

  const fileGroups = {};
  for (const d of allDiags) {
    if (!fileGroups[d.file]) fileGroups[d.file] = [];
    fileGroups[d.file].push(d.msg);
  }

  const sortedFiles = Object.entries(fileGroups).sort((a, b) => b[1].length - a[1].length);
  console.log("\nTop files:");
  sortedFiles.slice(0, 15).forEach((x) => {
    console.log(x[1].length + "x: " + x[0]);
    console.log("  -> " + x[1][0].split("\n")[0]);
  });
} catch (e) {
  console.log("Failed to parse:", e.message);
}
