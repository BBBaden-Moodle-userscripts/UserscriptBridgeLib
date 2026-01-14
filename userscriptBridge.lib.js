// Enhanced UserScript Bridge Library
// Provides communication between userscripts using BroadcastChannel API

// Initialize Logger if available, fallback to console
const BridgeLogger = typeof Logger !== 'undefined' ? Logger : {
    info: (comp, ...args) => console.log(`[${comp}]`, ...args),
    success: (comp, ...args) => console.log(`[${comp}] ✓`, ...args),
    warn: (comp, ...args) => console.warn(`[${comp}]`, ...args),
    error: (comp, ...args) => console.error(`[${comp}]`, ...args)
};

class Script {
    constructor() {
        this.bc = new window.BroadcastChannel("BBBUserscriptManager");
        this.listener();
        BridgeLogger.info('bridge', 'Script initialized:', info().name);
    }

    listener() {
        this.bc.onmessage = (event) => {
            const { type, script, data } = event.data;
            
            // Handle "all" target or specific script targeting
            if (script !== "all") {
                const currentInfo = info();
                if (script.namespace !== currentInfo.namespace) return;
                if (script.name !== currentInfo.name) return;
            }
            
            switch (type) {
                case "requestUserscriptDetails":
                    BridgeLogger.info('bridge', 'Sending userscript details');
                    this.sendInfo();
                    break;
                default:
                    BridgeLogger.warn('bridge', 'Unknown message type:', type);
                    break;
            }
        };
    }

    sendInfo() {
        const msg = buildMsg("userscriptDetails", info());
        BridgeLogger.success('bridge', 'Info sent for', info().name);
        this.bc.postMessage(msg);
    }

    close() {
        this.bc.close();
        BridgeLogger.info('bridge', 'Connection closed');
    }
}


class Manager {
    constructor() {
        this.bc = new window.BroadcastChannel("BBBUserscriptManager");
        BridgeLogger.info('bridge', 'Manager initialized');
    }

    fetchInstalledUserscripts() {
        return new Promise((resolve) => {
            const userscripts = [];
            let timeout;

            const listener = (event) => {
                if (event.data && event.data.type === 'userscriptDetails') {
                    BridgeLogger.info('bridge', 'Received details for', event.data.data.name);
                    
                    // Avoid duplicates
                    const exists = userscripts.some(s => 
                        s.name === event.data.data.name && 
                        s.namespace === event.data.data.namespace
                    );
                    
                    if (!exists) {
                        userscripts.push(event.data.data);
                    }
                }
            };

            this.bc.onmessage = listener;

            // Request userscript details
            const msg = this.buildMsgManager("requestUserscriptDetails", "all", "all");
            BridgeLogger.info('bridge', 'Requesting userscript details');
            this.bc.postMessage(msg);

            // Wait for responses (increased timeout for better reliability)
            timeout = setTimeout(() => {
                BridgeLogger.success('bridge', `Fetch complete: ${userscripts.length} script(s) found`);
                resolve(userscripts);
            }, 1500);
        });
    }

    buildMsgManager(type, data, target) {
        if (target === undefined) { target = "all"; }
        return { type, script: target, data };
    }

    close() {
        this.bc.close();
        BridgeLogger.info('bridge', 'Manager connection closed');
    }
}


function buildMsg(type, data) {
    const scriptInfo = info();
    const scriptID = { 
        name: scriptInfo.name, 
        namespace: scriptInfo.namespace 
    };
    return { type, script: scriptID, data };
}

function info() {
    // Support both GM and GM_info
    const GMinfo = typeof GM_info !== 'undefined' ? GM_info : 
                   (typeof GM !== 'undefined' && GM.info ? GM.info : null);
    
    if (!GMinfo) {
        BridgeLogger.warn('bridge', 'GM_info not available');
        return {
            name: 'Unknown Script',
            namespace: undefined,
            description: undefined,
            version: '0.0.0',
            permissions: [],
            run_at: undefined,
            scriptWillUpdate: undefined,
        };
    }

    const ScriptInfo = {
        name: GMinfo?.script?.name || 'Unknown Script',
        namespace: GMinfo?.script?.namespace || undefined,
        description: GMinfo?.script?.description || undefined,
        version: GMinfo?.script?.version || '0.0.0',
        permissions: GMinfo?.script?.grant || [],
        run_at: GMinfo?.script?.runAt || GMinfo?.script?.options?.run_at || undefined,
        scriptWillUpdate: GMinfo?.scriptWillUpdate || GMinfo?.script?.options?.check_for_updates || undefined,
        // Additional metadata for better identification
        icon: GMinfo?.script?.icon || undefined,
        downloadURL: GMinfo?.script?.downloadURL || undefined,
        updateURL: GMinfo?.script?.updateURL || undefined,
    };

    return ScriptInfo;
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
    window.UserscriptBridge = {
        Script,
        Manager,
        buildMsg,
        info
    };
}
