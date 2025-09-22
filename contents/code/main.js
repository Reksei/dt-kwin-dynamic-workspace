// Define maximized modes
const MAXIMIZED_MODE_FULL = 3; 
const MAXIMIZED_MODE_HORIZONTAL = 2; 
const MAXIMIZED_MODE_VERTICAL = 1;
const MAXIMIZED_MODE_OFF = 0;

// Initialize array for windows maximized with the "above others" enabled
const maximizedAboveOthers = [];

// Define function to execute on maximized status changed
function onMaximizedAboutToChange(maximizeMode, client) {
    // print info
    print("Selected window: " + client.caption);
    print("Maximized changed to: " + maximizeMode);

    // toggle "above others" off when a window gets maximized
    if (maximizeMode == MAXIMIZED_MODE_FULL) {
        let isFound = maximizedAboveOthers.indexOf(client) >= 0;
        if (client.keepAbove) {
            client.keepAbove = false;
            //save client into the array to toggle "above others" on when the window is unmaximized
            if (!isFound) {
                maximizedAboveOthers.push(client);
            }
        }
    }

    // toggle "above others" on when a window gets unmaximized
    if (maximizeMode != MAXIMIZED_MODE_FULL) {
        let isFound = maximizedAboveOthers.indexOf(client) >= 0;
        if (isFound) {
            client.keepAbove = true;
            maximizedAboveOthers.splice(maximizedAboveOthers.indexOf(client), 1);
        }
    }

    print("TRACKED WINDOWS: " + maximizedAboveOthers);
}

// Get the list of open windows
const clientList = workspace.stackingOrder;

// Attach listeners to existing maximizeable windows (when the script is started)
const maximizeAbleClientList = [];
for (let i = 0; i < clientList.length; i++) {
    let client = clientList[i];
    if (client.maximizable) {
        maximizeAbleClientList.push(client.caption);
        client.maximizedAboutToChange.connect((maximizeMode) => {
            onMaximizedAboutToChange(maximizeMode, client)
    });
    }
}

// Attach listener to new windows
workspace.windowAdded.connect(function(client) {
    client.maximizedAboutToChange.connect((maximizeMode) => {
        onMaximizedAboutToChange(maximizeMode, client)
    });
})

print("Maximizeable clients: " + maximizeAbleClientList); //debug purposes