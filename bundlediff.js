const program = require("commander");

program
  .version("0.1.0")
  .option("--path <path>", "Path")
  .option("--output <output>", "Output file")
  .parse(process.argv);

console.log("Running BundleDiff");



const fs = require("fs");
const path = require("path");
const sh = require("shelljs");
const ejs = require("ejs");
const { Diff2Html } = require("diff2html");
const tmp = require("tmp");
const tmpobj = tmp.dirSync({ mode: "0750", prefix: "bundlediff--" });

function clone(repositoryUrl, branchName) {
  const location = path.join(tmpobj.name, "source");
  sh.exec(
    `git clone --single-branch --branch ${branchName} --quiet ${repositoryUrl} ${location};`
  );
  return location;
}

function readConfigFile(path = ".") {
  return JSON.parse(fs.readFileSync(`${path}/.bundlediff.json`, "utf8"));
}

function buildMaster(path) {
  sh.exec(`cd ${path} && yarn --silent && yarn build`, { silent: true });
}

function buildHead(path) {
  sh.exec(`cd ${path} && yarn --silent && yarn build`, { silent: true });
}

function performDiff(master, head) {
  const diffFile = path.join(tmpobj.name, "comparison.diff");
  sh.exec(`
    git diff --no-index -- ${master} ${head} > ${diffFile}
`);

  let diff = fs.readFileSync(diffFile, "utf8");
  diff =  diff.replace(new RegExp(`${tmpobj.name}/source`, 'g'), "/MASTER");

  fs.unlinkSync(diffFile);
  return diff;
}

function writeDiff(diff, outputFile) {
  const htmlDiff = Diff2Html.getPrettyHtmlFromDiff(diff, {
    inputFormat: "diff",
    showFiles: true,
    outputFormat: "side-by-side"
  });

  const template = fs.readFileSync(
      path.join(__dirname, "ui/index.html"),
      "utf8"
  );

  const output = ejs.render(template, { htmlDiff });
  fs.writeFileSync(outputFile, output, "utf8");
  console.info(`Output written to ${outputFile}`);
}

function run(options) {
  const config = readConfigFile(options.path);
  const masterPath = clone(config.repositoryUrl, "master");
  const headPath = options.path;

  buildMaster(masterPath);
  buildHead(headPath);

  const diff = performDiff(
    path.join(masterPath, "dist/"),
    path.join(headPath, "dist/")
  );

  if (options.output) {
    writeDiff(diff, options.output);
  }
}



run(program);