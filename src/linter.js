const batteries = require("./batteries");
const { notify, getPrefs, rcWizard, newPath } = require("./util");

async function execLinter(editor) {
    const { document: doc } = editor;
    const prefs = getPrefs();

    /* —————————————————————————————————————————————————————————————————— */

    const opt = {
        args: [ "-f", "json", "--stdin", "--stdin-filename", doc.path ],
        cwd: nova.path.dirname(doc.path),
        env: nova.environment,
        stdio: "pipe",
        shell: "/bin/bash"
    };

    // Prefered executable location via $PATH
    opt.env.PATH = newPath();

    // Determine whether to auto-discover config, use specific config, or arbort
    const rc = await rcWizard(doc.path);
    if ( ! rc )                    return;
    else if ( rc === "standard")   opt.args.push("--config", batteries.standard);
    else if ( rc === "custom" )    opt.args.push("--config", rc);

    // Use pre-packaged "batteries" as basedir if needed otherwise use user-configured dir
    if ( prefs.basedir )           opt.args.push("--config-basedir", prefs.basedir);
    else if ( rc === "batteries" ) opt.args.push("--config-basedir", batteries.dir);

    /* —————————————————————————————————————————————————————————————————— */

    const process = new Promise((resolve, reject) => {
        let error = "";
        let output = "";

        const process = new Process("stylelint", opt);

        process.onStderr(line => error += line);
        process.onStdout(line => output += line);

        process.onDidExit(status => {
            if ( status === 0 || status === 2 )
                resolve(output);
            else
                reject(error);
        });

        process.start();

        const writer = process.stdin.getWriter();
        writer.ready.then(() => {
            const text = editor.getTextInRange(new Range(0, doc.length));
            writer.write(text);
            writer.close();
            process.start();
        });

        // For debugging purposes
        if ( nova.inDevMode() )
            console.log(`${process.args.slice(1).map(i => i.replace(/"/g, "")).join(" ")}`);
    });

    return JSON.parse(await process);
}

/* —————————————————————————————————————————————————————————————————— */
/* —————————————————————————————————————————————————————————————————— */

module.exports = execLinter;
