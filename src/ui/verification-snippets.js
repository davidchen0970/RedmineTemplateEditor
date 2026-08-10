import { block, sec } from "../core/state.js";
const COMMANDS = {
    journalctl: ["journalctl", "root@bmc-host:~# journalctl -o short-precise | grep obmc-console-server\n..."],
    systemctl: ["systemctl", "root@bmc-host:~# systemctl status obmc-console@ttyS0.service -l\n..."],
    i2c: ["i2cget/set", "root@bmc-host:~# i2cget -y 7 0x71 0xc\n0x00\nroot@bmc-host:~# i2cset -y 7 0x71 0xc 0x2"]
};
export function addVerificationSnippet(state, type) {
    let section = state.sections.find((item) => item.title === "結果驗證") || sec("結果驗證", true);
    if (!state.sections.includes(section)) state.sections.push(section);
    section.enabled = true;
    const command = COMMANDS[type];
    if (command) section.blocks.push(block("command", command[0], command[1]));
}
