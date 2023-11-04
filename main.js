const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const fs = require("fs");
const path = require("path");
const fse = require("fs-extra");

let win;

let folderPath = "";
const createWindow = () => {
    win = new BrowserWindow({
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            preload: path.join(__dirname, "src/preload.js"),
        },
        show: false,
        frame: false,
    });

    win.loadFile("index.html");
    win.once("ready-to-show", win.show);
};

app.whenReady().then(() => {
    createWindow();
    ipcMain.on("open-folder-dialog", openFile);
    ipcMain.on("read-dir", (event, dir) => {
        console.log("dddd", dir);
        event.sender.send("selected-dir", {
            path: dir,
            ...readDir(dir),
        });
    });
    ipcMain.on("close-me", closeMe);
    ipcMain.on("min-me", minMe);
    ipcMain.on("delete-all-file-selected", deleteAllFileSelected);
    ipcMain.handle("check-is-file", checkIsFile);
    ipcMain.on("organize-files-by-starting-char", organizeFilesByStartingChar);
    ipcMain.on("organize-files-by-extension", organizeFilesByExtension);

    ipcMain.on(
        "undo-organize-files-by-starting-char",
        undoOrganizeFilesByStartingChar
    );
    ipcMain.on(
        "undo-organize-files-by-extension",
        undoOrganizeFilesByExtension
    );
});

const closeMe = () => {
    app.quit();
};

const minMe = () => {
    win.minimize();
};

const checkIsFile = async (event, filePath) => {
    if (fs.existsSync(path.join(folderPath, filePath))) {
        let state = fs.statSync(path.join(folderPath, filePath));
        return state.isFile();
    }
    return false;
};

const deleteAllFileSelected = (event, files) => {
    console.log("files: ", files);
    files.forEach((file) => {
        try {
            if (fs.existsSync(path.join(folderPath, file))) {
                console.log("exists");
                let state = fs.statSync(path.join(folderPath, file));
                console.log(state);
                if (state.isDirectory()) {
                    fs.rmdirSync(path.join(folderPath, file), {
                        recursive: true,
                        force: true,
                    });
                } else {
                    fs.unlinkSync(path.join(folderPath, file));
                }
                event.sender.send("selected-dir", {
                    path: folderPath,
                    ...readDir(folderPath),
                });
            } else {
                event.sender.send("dir-not-exists");
            }
        } catch (err) {
            console.log(err);
        }
    });
};
const openFile = (event) => {
    dialog
        .showOpenDialog({
            properties: ["openDirectory"],
        })
        .then((result) => {
            folderPath = result.filePaths[0];
            console.log("folderPath: ", folderPath);
            event.sender.send("selected-dir", {
                path: folderPath,
                ...readDir(folderPath),
            });
        })
        .catch((err) => {
            console.log(err);
        });
};

const readDir = (directoryPath) => {
    const directoryData = {};

    const entries = fs.readdirSync(directoryPath, { withFileTypes: true });

    entries.forEach((entry) => {
        const entryPath = path.join(directoryPath, entry.name);

        if (entry.isDirectory()) {
            directoryData[entry.name] = readDir(entryPath);
        } else {
            directoryData[entry.name] = null;
        }
    });
    return directoryData;
};

function organizeFilesByStartingChar(event, directoryPath) {
    if (
        !fs.existsSync(directoryPath) ||
        !fs.lstatSync(directoryPath).isDirectory()
    ) {
        console.log(`Directory "${directoryPath}" does not exist.`);
        return;
    }

    const files = fs.readdirSync(directoryPath);

    for (const file of files) {
        const filePath = path.join(directoryPath, file);
        const isFile = fs.lstatSync(filePath).isFile();
        const firstChar = file[0].toLowerCase();

        if (isFile) {
            const newDirectory = path.join(directoryPath, firstChar);

            if (!fs.existsSync(newDirectory)) {
                fs.mkdirSync(newDirectory);
            }

            fs.renameSync(filePath, path.join(newDirectory, file));
            console.log(`Moved ${file} to ${path.join(newDirectory, file)}`);
        } else if (fs.lstatSync(filePath).isDirectory()) {
            organizeFilesByStartingChar(event, filePath);
        }
    }

    event.sender.send("selected-dir", {
        path: directoryPath,
        ...readDir(directoryPath),
    });
}

function undoOrganizeFilesByStartingChar(event, directoryPath) {
    if (
        !fs.existsSync(directoryPath) ||
        !fs.lstatSync(directoryPath).isDirectory()
    ) {
        console.log(`Directory "${directoryPath}" does not exist.`);
        return;
    }

    let dirToDelete = [];

    function reset(dirPath) {
        const files = fs.readdirSync(dirPath);
        for (const file of files) {
            const filePath = path.join(dirPath, file);
            const isFile = fs.lstatSync(filePath).isFile();

            if (isFile) {
                const fileName = path.basename(filePath);
                const newDirectory = path.join(dirPath, "..");

                console.log("newDirectory", newDirectory);
                const originalFilePath = path.join(newDirectory, fileName);

                if (fs.existsSync(originalFilePath)) {
                    console.log(
                        `File ${fileName} already exists in ${newDirectory}`
                    );
                    continue;
                }

                console.log(`Moved ${fileName} to ${dirPath}`);
                dirToDelete.push(dirPath);
                fs.renameSync(filePath, originalFilePath);
            } else if (fs.lstatSync(filePath).isDirectory()) {
                reset(filePath);
            }
        }
    }

    reset(directoryPath);
    dirToDelete = [...new Set(dirToDelete)];
    dirToDelete.forEach((dir) => {
        fs.rmdirSync(dir);
        console.log(`Deleted ${dir}`);
    });

    event.sender.send("selected-dir", {
        path: directoryPath,
        ...readDir(directoryPath),
    });
}

function organizeFilesByExtension(event, directoryPath) {
    if (
        !fs.existsSync(directoryPath) ||
        !fs.lstatSync(directoryPath).isDirectory()
    ) {
        console.log(`Directory "${directoryPath}" does not exist.`);
        return;
    }

    const files = fs.readdirSync(directoryPath);

    for (const file of files) {
        const filePath = path.join(directoryPath, file);
        const isFile = fs.lstatSync(filePath).isFile();
        const extension = path.extname(file).toLowerCase();

        if (isFile) {
            const newDirectory = path.join(directoryPath, extension);

            if (!fs.existsSync(newDirectory)) {
                fs.mkdirSync(newDirectory);
            }

            fs.renameSync(filePath, path.join(newDirectory, file));
            console.log(`Moved ${file} to ${path.join(newDirectory, file)}`);
        } else if (fs.lstatSync(filePath).isDirectory()) {
            organizeFilesByExtension(event, filePath);
        }
    }

    event.sender.send("selected-dir", {
        path: directoryPath,
        ...readDir(directoryPath),
    });
}

function undoOrganizeFilesByExtension(event, directoryPath) {
    if (
        !fs.existsSync(directoryPath) ||
        !fs.lstatSync(directoryPath).isDirectory()
    ) {
        console.log(`Directory "${directoryPath}" does not exist.`);
        return;
    }
    let dirToDelete = [];

    function reset(dirPath) {
        const files = fs.readdirSync(dirPath);
        for (const file of files) {
            const filePath = path.join(dirPath, file);
            const isFile = fs.lstatSync(filePath).isFile();
            const extension = path.extname(file).toLowerCase();

            if (isFile && extension !== "") {
                const fileName = path.basename(filePath);
                const newDirectory = path.join(dirPath, "..");

                console.log("newDirectory", newDirectory);
                const originalFilePath = path.join(newDirectory, fileName);

                if (fs.existsSync(originalFilePath)) {
                    console.log(
                        `File ${fileName} already exists in ${newDirectory}`
                    );
                    continue;
                }

                console.log(`Moved ${fileName} to ${dirPath}`);
                dirToDelete.push(dirPath);
                fs.renameSync(filePath, originalFilePath);
            } else if (fs.lstatSync(filePath).isDirectory()) {
                reset(filePath);
            }
        }
    }

    reset(directoryPath);
    dirToDelete = [...new Set(dirToDelete)];
    dirToDelete.forEach((dir) => {
        fs.rmdirSync(dir);
        console.log(`Deleted ${dir}`);
    });

    event.sender.send("selected-dir", {
        path: directoryPath,
        ...readDir(directoryPath),
    });
}
