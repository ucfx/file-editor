let directoryData = null;
let dirPath = null;
window.addEventListener("DOMContentLoaded", () => {
    const { ipcRenderer } = require("electron");
    const btnClose = document.getElementById("btn-close");
    const btnCloseFolder = document.getElementById("btn-close-folder");
    const btnMin = document.getElementById("btn-min");
    const btnChooseDir = document.getElementById("btn-choose-dir");
    const conatainer = document.getElementsByClassName("container");
    const directoryContainer = document.getElementById("directory-container");
    const searchInput = document.getElementById("search-input");
    const btnDeleteAllFileSelected = document.getElementById(
        "btn-delete-all-file-selected"
    );
    const btnConfirm = document.getElementById("btn-confirm");
    const btnCancel = document.getElementById("btn-cancel");
    const btnDublicatedFiles = document.getElementById(
        "btn-get-dublicated-files"
    );
    const btnInputDuplicate = document.getElementById("input-check-dublicate");
    const btnOrganize = document.getElementById("btn-organize");

    btnOrganize.addEventListener("click", (event) => {
        ipcRenderer.send("organize-files-by-starting-char", dirPath);
    });
    btnConfirm.addEventListener("click", (event) => {
        const checkedFiles = getCheckedFiles();
        if (checkedFiles.length === 0) return;
        ipcRenderer.send("delete-all-file-selected", checkedFiles);
        if (btnInputDuplicate.checked) {
            setTimeout(() => {
                getDuplicateFile();
            }, 50);
        }
        removeShowClass();
    });
    btnCancel.addEventListener("click", (event) => {
        removeShowClass();
    });

    const removeShowClass = () => {
        document.querySelector(".prompt").classList.remove("show");
    };

    btnDeleteAllFileSelected.addEventListener("click", (event) => {
        const checkedFiles = getCheckedFiles();

        if (checkedFiles.length === 0) return;
        document.querySelector(".prompt").classList.add("show");
    });

    btnCloseFolder.addEventListener("click", (event) => {
        conatainer[0].classList.remove("selected");
        document.getElementById("directory-container").innerHTML = "";

        directoryContainer.classList.remove("collapsed");
        btnInputDuplicate.checked = false;
        directoryData = null;
    });

    btnChooseDir.addEventListener("click", (event) => {
        ipcRenderer.send("open-folder-dialog");
    });

    ipcRenderer.on("dir-not-exists", (event) => {
        console.log("dir not exists");
    });

    ipcRenderer.on("selected-dir", (event, result) => {
        dirPath = result.path;
        delete result.path;

        if (result) {
            document.getElementById(
                "selected-dir"
            ).innerHTML = `Dir: ${dirPath}`;

            conatainer[0].classList.add("selected");

            directoryContainer.innerHTML = "";

            directoryData = result;
            createDirectoryStructure(directoryContainer, directoryData);
            setEvents();
        }
    });

    ipcRenderer.on("dir-is-not-empty", (event) => {
        console.log("Dir is Not Empty");
    });

    btnClose.addEventListener("click", (event) => {
        ipcRenderer.send("close-me");
    });

    btnMin.addEventListener("click", (event) => {
        ipcRenderer.send("min-me");
    });

    searchInput.addEventListener("keyup", async (event) => {
        btnInputDuplicate.checked = false;
        const searchValue = event.target.value;
        if (!directoryData) return;
        if (searchValue === "") {
            ipcRenderer.send("read-dir", dirPath);
            directoryContainer.classList.remove("collapsed");
            return;
        }
        const files = searchFiles(directoryData, searchValue);
        let dirData = await buildDirectoryStructure(files);
        console.log("dirDate", dirData);
        directoryContainer.innerHTML = "";
        directoryContainer.classList.add("collapsed");
        createDirectoryStructure(directoryContainer, dirData);
        setEvents();
        setDisplayBlock();
    });

    function createDirectoryStructure(
        container,
        data,
        dublicate = false,
        path = ""
    ) {
        console.log("path:::: ", data);
        const ul = document.createElement("ul");

        if (dublicate) {
            directoryContainer.classList.add("collapsed");
            directoryContainer.classList.add("dublicated");
        }
        for (const key in data) {
            const li = document.createElement("li");
            const span = document.createElement("span");
            const i = document.createElement("i");
            const pathInput = document.createElement("input");
            const checkInput = document.createElement("input");

            pathInput.setAttribute("type", "hidden");
            pathInput.setAttribute("name", "path");
            pathInput.setAttribute("value", path);

            checkInput.setAttribute("type", "checkbox");
            checkInput.setAttribute("name", "check");

            checkInput.setAttribute("id", key);
            checkInput.setAttribute("value", key);

            i.classList.add("fa-light");
            i.classList.add(dublicate ? "fa-search" : "fa-file-alt");
            span.textContent = key;

            li.appendChild(pathInput);
            if (!dublicate) li.appendChild(checkInput);
            li.appendChild(i);
            li.appendChild(span);
            if (data[key]) {
                i.classList.add("fa-folder");
                span.classList.add("dropdown");
                li.appendChild(
                    createDirectoryStructure(
                        document.createElement("div"),
                        data[key],
                        false,
                        `${dublicate ? "" : `${path}/${key}`}`
                    )
                );
            }
            ul.appendChild(li);
        }

        container.appendChild(ul);
        return ul;
    }

    function getFilePath(input) {
        const path = input.parentNode.children[0].value;
        const fileName = input.value;
        return `${path}/${fileName}`;
    }

    function getCheckedFiles() {
        const checkedFiles = [];
        const checked = document.querySelectorAll(
            'input[name="check"]:checked'
        );

        checked.forEach((item) => {
            checkedFiles.push(getFilePath(item));
        });

        return checkedFiles;
    }

    function searchFiles(directory, fileName, currentPath = []) {
        let foundPaths = [];

        for (const key in directory) {
            const newPath = [...currentPath, key];

            if (key.toLocaleLowerCase().includes(fileName.toLocaleLowerCase()))
                foundPaths.push(newPath.join("/"));

            if (directory[key] && typeof directory[key] === "object") {
                const result = searchFiles(directory[key], fileName, newPath);
                foundPaths = foundPaths.concat(result);
            }
        }
        console.log("foundPaths", foundPaths);
        return foundPaths;
    }

    async function buildDirectoryStructure(filePaths) {
        console.log("filePaths: ", filePaths);
        const directory = {};

        await Promise.all(
            filePaths.map(async (filePath) => {
                const pathComponents = filePath.split("/");
                let currentLevel = directory;
                await Promise.all(
                    pathComponents.map(async (component, index) => {
                        if (!currentLevel[component]) {
                            if (index === pathComponents.length - 1) {
                                if (
                                    await ipcRenderer.invoke(
                                        "check-is-file",
                                        filePath
                                    )
                                ) {
                                    currentLevel[component] = null;
                                }
                            } else {
                                currentLevel[component] = {};
                            }
                        }
                        currentLevel = currentLevel[component];
                    })
                );
            })
        );
        console.log("res: ", directory);
        return directory;
    }

    function setEvents() {
        document.querySelectorAll(".dropdown").forEach((item) => {
            item.addEventListener("click", (event) => {
                const ul = event.target.nextSibling;
                ul.style.display =
                    ul.style.display === "none" || ul.style.display === ""
                        ? "block"
                        : "none";
            });
        });
    }

    async function getDuplicateFile() {
        if (!btnInputDuplicate.checked) {
            directoryContainer.classList.remove("dublicated");
            directoryContainer.classList.remove("collapsed");
            directoryContainer.innerHTML = "";

            createDirectoryStructure(directoryContainer, directoryData);
            setEvents();
            setDisplayNone();
            return;
        }

        const dublicatedFiles = findDuplicates(directoryData);
        console.log("dublicatedFiles:: ", dublicatedFiles);
        dirStructure = {};

        const promises = Object.keys(dublicatedFiles).map(async (key) => {
            let dirData = {};
            await Promise.all(
                dublicatedFiles[key].map(async (item) => {
                    item = item.split("/");
                    item.pop();
                    item = item.join("\\");
                    console.log("item", item);
                    dirData[item] = {};
                    dirData[item][key] = null;
                })
            );
            dirStructure[key] = dirData;
            console.log(dirData);
        });
        await Promise.all(promises);

        console.log("dirDate", dirStructure);
        directoryContainer.innerHTML = "";
        createDirectoryStructure(directoryContainer, dirStructure, true);
        setEvents();
        setDisplayBlock();
        isDublicated = true;
    }

    btnInputDuplicate.addEventListener("change", getDuplicateFile);
    const findDuplicates = (directoryData) => {
        let filesPath = {};

        const findFiles = (directoryData, path = "") => {
            for (const key in directoryData) {
                const newPath = `${path}/${key}`;

                if (directoryData[key]) {
                    findFiles(directoryData[key], newPath);
                } else {
                    filesPath[key] = [...(filesPath[key] || []), newPath];
                }
            }
        };

        findFiles(directoryData);

        const dublicatedFiles = Object.assign({ ...filesPath });
        Object.keys(dublicatedFiles).forEach((key) => {
            if (Object.keys(dublicatedFiles[key]).length < 2) {
                delete dublicatedFiles[key];
            }
        });
        console.log("filesPath  ---: ", dublicatedFiles);

        return { ...dublicatedFiles };
    };

    function setDisplayBlock() {
        document.querySelectorAll("ul").forEach((ul) => {
            ul.style.display = "block";
        });
    }

    function setDisplayNone() {
        document.querySelectorAll("ul>li>ul").forEach((ul) => {
            ul.style.display = "none";
        });
    }
});
