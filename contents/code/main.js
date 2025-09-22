//====================== Config and definitions =========================
//CONFIG
const CONFIG_TOGGLE_ABOVE_OTHERS_WHEN_MAXIMIZED = readConfig("toggleAboveOthersOnMaximized", true);
const CONFIG_MOVE_TO_NEW_DESKTOP_WHEN_MAXIMIZED = readConfig("moveToNewDesktopOnMaximized", true);
const CONFIG_MOVE_TO_NEW_DESKTOP_WHEN_STARTED_MAXIMIZED = readConfig("moveToNewDesktopOnStartedMaximized", true);
const CONFIG_TOGGLE_ABOVE_OTHERS_WHEN_FULLSCREENED = readConfig("toggleAboveOthersOnFullScreen", true);
const CONFIG_MOVE_TO_NEW_DESKTOP_WHEN_FULLSCREENED = readConfig("moveToNewDesktopOnFullScreen", true);
const CONFIG_MOVE_TO_NEW_DESKTOP_WHEN_STARTED_FULLSCREENED = readConfig("moveToNewDesktopOnStartedFullScreen", true);

const CONFIG_FIX_DESKTOP_SWITCH_ANIMATION = readConfig("fixDesktopSwitchAnimation", true);

const CONFIG_CLEANUP_EMPTY_DESKTOPS = readConfig("cleanupEmptyDesktops", true);
const CONFIG_ADD_ONE_DESKTOP_ON_THE_RIGHT = readConfig("keepSpareDesktop", true);;

const CONFIG_ENABLE_LOGGING = false;//not included in GUI config

// ======================= Initialize variables =========================
// Initialize array for windows maximized with the "above others" enabled
// array of KWin Window
const maximizedAboveOthersList = [];

// Initialize array for dynamic workspace creation
// array of objects 
// {
//	originalDesktopsList: [KWin Desktop],
//  originalDesktop: KWin Desktop,
//  client: KWin Window,
//  newDesktop: KWin Desktop,
//  startedMaximized: bool
// }
const maximizedToOwnDesktopList = [];

// Animation fix causes multiple "desktop changed events", this variable should prevent that
let animationFixRunning = false;

// ========================= Define functions =============================
//#region TOOLS
//function to check if a client is a "normal" window (true = normal)
function checkNormalClient(client) {
	const isNotNormal = client.skipPager || client === null || !client.normalWindow || client.outline;
	return !isNotNormal;
}

//get the number of the next desktop
function getNextDesktopNumber(currentDesktop) {
	const currentDesktopNumber = workspace.desktops.findIndex(desktop => {
		return desktop == currentDesktop;
	})
	return currentDesktopNumber + 1;
}

//get the number of the previous desktop
function getPreviousDesktopNumber(currentDesktop) {
	const currentDesktopNumber = workspace.desktops.findIndex(desktop => {
		return desktop == currentDesktop;
	})
	return (currentDesktopNumber - 1) < 0 ? 0 : currentDesktopNumber - 1;
}

//check if window is maximized
function checkWindowMaximized(client) {
	// Get the area a window would occupy when maximized
	const maximizeArea = workspace.clientArea(KWin.MaximizeArea, client);
	// Check if the window's current height and width match the maximized area
	return client.height === maximizeArea.height && client.width === maximizeArea.width;
}

//#endregion


//#region DESKTOPS_MANAGEMENT
// get desktops map
function getDesktopsMap() {
	const desktopsMap = []; //array of objects {desktop: KWin Desktop, clients: [KWin Client]}

	//prepare the list of desktops
	workspace.desktops.forEach(desktop => {
		desktopsMap.push({
			desktop: desktop,
			clients: []
		});
	});
	
	//cycle through each existing client
	workspace.stackingOrder.forEach(client => {
		//check if the client is a "normal" window
		const isNormalClient = checkNormalClient(client);
		//skip if the client isn't a "normal" window
		if (!isNormalClient) return;

		//if client is on all desktops, map it to all desktops
		if (client.onAllDesktops) {
			desktopsMap.forEach(desktop => {
				const isClientPresentInDesktop = desktop.clients.includes(client);
				if (!isClientPresentInDesktop) {
					desktop.clients.push(client);
				}
			});
			//go to next client
			return;
		} 

		//check which desktops the client belongs to
		client.desktops.forEach(clientDesktop => {
			//find the desktop in the map
			const desktopMapIndex = desktopsMap.findIndex((map) => {
				return map.desktop == clientDesktop;
			})
			//if map desktop found
			if (desktopMapIndex >= 0) {
				//check if client is already mapped to the desktop
				const isClientPresentInDesktop = desktopsMap[desktopMapIndex].clients.includes(client);
				//if client is not yet mapped to the desktop, map it
				if (!isClientPresentInDesktop) {
					desktopsMap[desktopMapIndex].clients.push(client);
				}
			}
		})
	})

	return desktopsMap;
}

//get clients of a desktop
function getDesktopClients(desktop) {
	const desktopInfo = getDesktopsMap().find(map => {
		return map.desktop == desktop;
	});
	return desktopInfo.clients;
}

//print desktops map to console
function printDesktopsMap() {
	const map = getDesktopsMap();
	print("=================== DESKTOPS MAP ===================");
	map.forEach((element, index) => {
		print("  DESKTOP " + index + ":");
		print("    X11 NUMBER: " + element.desktop.x11DesktopNumber);
		print("    NAME: " + element.desktop.name);
		print("    CLIENTS: " + element.clients.length);
		element.clients.forEach(element => {
			print("      CLIENT CAPTION: " + element.caption);
		})
	});
}

//print info about one desktop
function printDesktopInfo(desktop) {
	print("=================== DESKTOP INFO ===================")
	print("DESKTOP: " + desktop);
	const desktopClients = getDesktopClients(desktop);
	print("DESKTOP CLIENTS: " + desktopClients.length)
	desktopClients.forEach(client => {
		print("  " + client.caption);
	})
}
//#endregion DESKTOPS_MANAGEMENT


//#region SCREENS_MANAGEMENT
// get screens map
function getScreensMap() {
	const screensMap = []; //array of objects {desktop: KWin Output, clients: [KWin Client]}

	//prepare the list of screens
	workspace.screens.forEach(screen => {
		screensMap.push({
			screen: screen,
			clients: []
		});
	});
	
	//cycle through each existing client
	workspace.stackingOrder.forEach(client => {
		//check if the client is a "normal" window
		const isNormalClient = checkNormalClient(client);
		//skip if the client isn't a "normal" window
		if (!isNormalClient) return;

		//map clients to corresponding screens
		const screenMapIndex = screensMap.findIndex(map => {
			return map.screen == client.output;
		})
		if (screenMapIndex >= 0) {
			//check if client is already mapped to the desktop
			const isClientPresentInScreen = screensMap[screenMapIndex].clients.includes(client);
			//if client is not yet mapped to the desktop, map it
			if (!isClientPresentInScreen) {
				screensMap[screenMapIndex].clients.push(client);
			}
		}
	})

	return screensMap;
}

//get clients of a screen
function getScreenClients(screen) {
	const screenInfo = getScreensMap().find(map => {
		return map.screen == screen;
	});
	return screenInfo.clients;
}

//print screens map to console
function printScreensMap() {
	const map = getScreensMap();
	print("=================== SCREENS MAP ===================");
	map.forEach((element, index) => {
		print("  SCREEN " + index + ":");
		print("    ID: " + element.screen);
		print("    CLIENTS: " + element.clients.length);
		element.clients.forEach(element => {
			print("      CLIENT CAPTION: " + element.caption);
		})
	});
}

//print info about one screen
function printScreenInfo(screen) {
	print("=================== SCREEN INFO ===================")
	print("SCREEN: " + screen);
	const screenClients = getScreenClients(screen);
	print("SCREEN CLIENTS: " + screenClients.length)
	screenClients.forEach(client => {
		print("  " + client.caption);
	})
}
//#endregion SCREENS_MANAGEMENT


//get list of client on a specific desktop AND screen
function getClientsListDS(desktop, screen) {
	const desktopClients = getDesktopClients(desktop);
	const screenClients = getScreenClients(screen);
	const clientsDS = desktopClients.filter(desktopClient => {
		return screenClients.includes(desktopClient);
	})

	return clientsDS;
}

//print the list of clients on a specific desktop AND screen
function printClientsListDS(desktop, screen) {
	const clientsDS = getClientsListDS(desktop, screen);
	print("========== ACTUAL CLIENTS ==========")
	clientsDS.forEach(client => {
		print("  " + client.caption);
	})
}


//check if a new desktop is needed
function checkIfNewDesktopNeeded(client) {
	//get list of clients on the desktop
	if (CONFIG_ENABLE_LOGGING) {
		printDesktopInfo(workspace.currentDesktop);
		printScreenInfo(client.output);
		printClientsListDS(workspace.currentDesktop, client.output);
	}

	const clientListDS = getClientsListDS(workspace.currentDesktop, client.output);
	//if there is only one client on the desktop, no need for new desktop
	if (clientListDS.length == 1) {
		if (CONFIG_ENABLE_LOGGING) print("NO NEED FOR NEW DESKTOP COND 1");
		return false;
	}

	//if there is more than 1 client, check if others are "on all desktops"
	const otherClients = clientListDS.filter(clientDS => {
		return client != clientDS;
	})
	const otherClientsOnAllDesktops = otherClients.findIndex(otherClient => !otherClient.onAllDesktops) < 0;
	if (otherClientsOnAllDesktops) {
		if (CONFIG_ENABLE_LOGGING) print("NO NEED FOR NEW DESKTOP COND 2");
		return false;
	}

	//new desktop required
	if (CONFIG_ENABLE_LOGGING) print("NEW DESKTOP REQUIRED")
	return true;
}

//remove desktop and shift to the left (attempt to fix animation)
function removeDesktopAndShift(targetDesktop, desktopToRemove) {
	print("REMOVE AND SHIFT STARTED");
	animationFixRunning = true;
	//check animation direction
	//true = to the left, false = to the right
	const direction = targetDesktop.x11DesktopNumber < desktopToRemove.x11DesktopNumber ? true : false;

	if (direction) {
		//get the desktop on the right number
		const rightDesktopNumber = getNextDesktopNumber(desktopToRemove);
		//switch to the desktop on the right
		const rightDesktopNumberFiltered = rightDesktopNumber < 0 || rightDesktopNumber >= workspace.desktops.length ? workspace.desktops.length - 1 : rightDesktopNumber;
		workspace.currentDesktop = workspace.desktops[rightDesktopNumberFiltered];
		//remove desktop
		workspace.removeDesktop(desktopToRemove);
		//switch to the target desktop
		workspace.currentDesktop = targetDesktop;
	} else {
		//get the desktop on the left number
		const leftDesktopNumber = getPreviousDesktopNumber(desktopToRemove);
		//switch to the desktop on the left
		const leftDesktopNumberFiltered = leftDesktopNumber < 0 ? 0 : leftDesktopNumber;
		workspace.currentDesktop = workspace.desktops[leftDesktopNumberFiltered];
		//remove desktop
		workspace.removeDesktop(desktopToRemove);
		//switch to the target desktop
		workspace.currentDesktop = targetDesktop;
	}
	animationFixRunning = false;
	print("REMOVE AND SHIFTFINISHED");
}

// switch off "above others" when a window is maximized
function handleAboveOthersOnMaximized(maximizedClient) {
	const isMaximizedAboveOthers = maximizedAboveOthersList.indexOf(maximizedClient) >= 0;
	if (maximizedClient.keepAbove) {
		maximizedClient.keepAbove = false;
		//save client into the array to toggle "above others" on when the window is unmaximized
		if (!isMaximizedAboveOthers) {
			maximizedAboveOthersList.push(maximizedClient);
		}
	}
}

// switch on "above others" when a window is unmaximized (for the windows that were above others before being maximized)
function handleAboveOthersOnUnMaximized(unmaximizedClient) {
	const isMaximizedAboveOthers = maximizedAboveOthersList.indexOf(unmaximizedClient) >= 0;
	if (isMaximizedAboveOthers) {
		unmaximizedClient.keepAbove = true;
		maximizedAboveOthersList.splice(maximizedAboveOthersList.indexOf(unmaximizedClient), 1);
	}
}

//move a window to a new desktop when maximized
function handleNewDesktopOnMaximized(maximizedClient, isStartedMaximized) {
	let conditionToCreateDekstop = false;

	//check if a new desktop is required
	conditionToCreateDekstop =checkIfNewDesktopNeeded(maximizedClient);

	if (conditionToCreateDekstop) {
		//store data to the array
		//part 1 - store original desktops and client info
		const dataObj = {};
		dataObj.originalDesktopsList = [];
		maximizedClient.desktops.forEach(desktop => {
			dataObj.originalDesktopsList.push(desktop);
		})
		dataObj.originalDesktop = workspace.currentDesktop;
		dataObj.client = maximizedClient;
		dataObj.startedMaximized = isStartedMaximized;

		//create new desktop
		const newDesktopNumber = getNextDesktopNumber(workspace.currentDesktop);
		workspace.createDesktop(newDesktopNumber, maximizedClient.caption);
		const newDesktop = workspace.desktops[newDesktopNumber];

		//store data to the array
		//part 2 - store new desktop info and push object to the array
		dataObj.newDesktop = newDesktop;
		maximizedToOwnDesktopList.push(dataObj);

		//move client to the new desktop and change current desktop to the new one
		maximizedClient.desktops = [newDesktop];
		workspace.currentDesktop = newDesktop;
	}

}

//remove the desktop that was created specifically for the maximized window
function handleNewDekstopOnUnmaximized(unmaximizedClient) {
	//check if client is on dedicated desktop
	const arrayIndex = maximizedToOwnDesktopList.findIndex(obj => {
		return obj.client == unmaximizedClient && obj.newDesktop == workspace.currentDesktop;
	})

	//define condition to remove desktop
	const conditionToRemoveDesktop = arrayIndex >= 0;

	if (conditionToRemoveDesktop) {
		//restore original desktops of the client
		unmaximizedClient.desktops = maximizedToOwnDesktopList[arrayIndex].originalDesktopsList;
		//change screen geometry if the scren was originally started maximized (otherwise it spawns in the top left corner)
		if (maximizedToOwnDesktopList[arrayIndex].startedMaximized){
			//unmaximize and move to center
			const screenGeometry = workspace.activeScreen.geometry;
			const newWidth = screenGeometry.width / 2;
			const newHeight = screenGeometry.height / 2;
			const newX = (screenGeometry.width - newWidth) / 2;
			const newY = (screenGeometry.height - newHeight) / 2;
			unmaximizedClient.frameGeometry = {x: newX, y: newY, width: newWidth, height: newHeight};
		}

		if (CONFIG_FIX_DESKTOP_SWITCH_ANIMATION) { //still won't fix animation if there is no deksktop on the right
			removeDesktopAndShift(maximizedToOwnDesktopList[arrayIndex].originalDesktop, maximizedToOwnDesktopList[arrayIndex].newDesktop);
		} else {
			//change current desktop to the original one
			workspace.currentDesktop = maximizedToOwnDesktopList[arrayIndex].originalDesktop;
			//remove the dedicated desktop
			workspace.removeDesktop(maximizedToOwnDesktopList[arrayIndex].newDesktop);
		}

		//remove array item
		maximizedToOwnDesktopList.splice(arrayIndex, 1);
	}

}

// Define function to execute on maximized status changed
function onMaximizedChanged(client) {
    // print info
	if (CONFIG_ENABLE_LOGGING) {
		print("======== WINDOW MAXIMIZED CHANGED ========")
		print("Selected window: " + client.caption);
		print("Maximized changed to: " + checkWindowMaximized(client));
	}
	
    // window is maximized
    if (checkWindowMaximized(client)) {
        // keep above others handler
		if (CONFIG_TOGGLE_ABOVE_OTHERS_WHEN_MAXIMIZED) {
			handleAboveOthersOnMaximized(client);
		}

		// create a new desktop and move maximuzed window to that desktop
		if (CONFIG_MOVE_TO_NEW_DESKTOP_WHEN_MAXIMIZED) {
			handleNewDesktopOnMaximized(client, false);
		}
    }

    // window is unmaximized
    if (!checkWindowMaximized(client)) {
        // keep above others handler
		if (CONFIG_TOGGLE_ABOVE_OTHERS_WHEN_MAXIMIZED) {
			handleAboveOthersOnUnMaximized(client);
		}
		
		// remove desktop created for a maximized app
		if (CONFIG_MOVE_TO_NEW_DESKTOP_WHEN_MAXIMIZED) {
			handleNewDekstopOnUnmaximized(client);
		}
    }

	if (CONFIG_ENABLE_LOGGING) {
		print("DEBUG ABOVE OTHERS LIST: " + maximizedAboveOthersList);
		print("DEBUG TO OWN DESKTOP LIST: " + maximizedToOwnDesktopList);
	}
}

// Define function to execute on fullscreen status changed
function onFullScreenChanged(client) {
    // print info
	if (CONFIG_ENABLE_LOGGING) {
		print("======== WINDOW FULLSCREEN CHANGED ========")
		print("Selected window: " + client.caption);
		print("Fullscreen changed to: " + client.fullScreen);
	}
	
    // window is fullscreened
    if (client.fullScreen) {
        // keep above others handler
		if (CONFIG_TOGGLE_ABOVE_OTHERS_WHEN_FULLSCREENED) {
			handleAboveOthersOnMaximized(client);
		}

		// create a new desktop and move maximuzed window to that desktop
		if (CONFIG_MOVE_TO_NEW_DESKTOP_WHEN_FULLSCREENED) {
			handleNewDesktopOnMaximized(client, false);
		}
    }

    // window is unfullscreened
    if (!client.fullScreen) {
        // keep above others handler
		if (CONFIG_TOGGLE_ABOVE_OTHERS_WHEN_FULLSCREENED) {
			handleAboveOthersOnUnMaximized(client);
		}
		
		// remove desktop created for a maximized app
		if (CONFIG_MOVE_TO_NEW_DESKTOP_WHEN_FULLSCREENED) {
			handleNewDekstopOnUnmaximized(client);
		}
    }

	if (CONFIG_ENABLE_LOGGING) {
		print("DEBUG ABOVE OTHERS LIST: " + maximizedAboveOthersList);
		print("DEBUG TO OWN DESKTOP LIST: " + maximizedToOwnDesktopList);
	}
}

// Define function to execute on window removed
function onWindowRemoved(removedClient) {
	// if client is stored in the "maximized above others", remove it
	if (maximizedAboveOthersList.includes(removedClient)) {
		maximizedAboveOthersList.splice(maximizedAboveOthersList.indexOf(removedClient), 1);
	}

	// if client is stored in the "maximized to own desktop", remove it from the array, remove the desktop, move to the desktop on the left
	const separateDesktopIndex = maximizedToOwnDesktopList.findIndex(obj => {
		return obj.client == removedClient && obj.newDesktop == workspace.currentDesktop;
	})
	if (separateDesktopIndex >= 0) {
		//move to the desktop on the left
		const previousDesktopNumber = getPreviousDesktopNumber(workspace.currentDesktop);

		//remove the dedicated desktop
		if (CONFIG_FIX_DESKTOP_SWITCH_ANIMATION) {
			removeDesktopAndShift(workspace.desktops[previousDesktopNumber], workspace.currentDesktop)
		} else {
			workspace.currentDesktop = workspace.desktops[previousDesktopNumber];
			//remove the dedicated desktop
			workspace.removeDesktop(workspace.currentDesktop);
		}

		//remove array item
		maximizedToOwnDesktopList.splice(separateDesktopIndex, 1);
	}
}

// Function to check if a spare desktop is needed (return true if a spare desktop is required)
function checkSpareDesktopRequired() {
	//find the last desktop
	const lastDesktop = workspace.desktops[workspace.desktops.length - 1];
	//get the list of clients on the last desktop
	const lastDesktopClientsList = getClientsListDS(lastDesktop, workspace.activeScreen);
	//check if all of those clients are "on all desktops"
	const lastDesktopClientsOnAllDesktops = lastDesktopClientsList.findIndex(client => !client.onAllDesktops) < 0;
	//define condition to create a spare desktop
	return lastDesktopClientsList.length > 0 && !lastDesktopClientsOnAllDesktops;
}

// Handle spare desktop on the right
function handleSpareDesktop() {
	if (checkSpareDesktopRequired()) {
		//create a spare desktop on the right with default name
		workspace.createDesktop(workspace.desktops.length, "");
	} else {
		
	}
}

// Empty desktops cleanup
function desktopsCleanup(previousDesktop) {
	if (workspace.desktops.length > 1) {
		//get the list of desktops (has to be an actually new array, not a reference, therefore map)
		const desktops = workspace.desktops.map(d => d);
		//cycle through each desktop
		desktops.forEach((desktop) => {
			if (desktop == desktops[desktops.length - 1]) {
				//skip the last desktop
				return;
			}
			//get the list of client on the desktop
			const clients = getClientsListDS(desktop, workspace.activeScreen);
			//check if there are no clients
			const desktopEmpty = clients.length == 0;
			//check if all the clients are "on all desktops"
			const clientsOnAllDesktops = clients.findIndex(client => !client.onAllDesktops) < 0;
			if (desktopEmpty || clientsOnAllDesktops) {
				//remove desktop
				if (CONFIG_FIX_DESKTOP_SWITCH_ANIMATION && desktop == previousDesktop) {
					removeDesktopAndShift(workspace.currentDesktop, desktop);
				} else {
					workspace.removeDesktop(desktop);
				}
			} else {
				
			}
		})
	}
}

// ============================  Attach listeners ===============================
// Attach listeners to existing maximizeable windows (when the script is started)
workspace.stackingOrder.forEach((client) => {
	//connect to maximized changed event
    if (client.maximizable && checkNormalClient(client)) {
        client.maximizedChanged.connect(() => {
            onMaximizedChanged(client);
    	});
    }
	//connect to fullscreen changed event
    if (client.fullScreenable && checkNormalClient(client)) {
        client.fullScreenChanged.connect(() => {
            onFullScreenChanged(client);
    	});
    }
})

// A window added
workspace.windowAdded.connect((client) => {
	if (checkNormalClient(client)) {
		if (CONFIG_ENABLE_LOGGING) print("======== NEW WINDOW OPENED ===========");

		//connect to maximized changed event
		if (client.maximizable) {
			//is window maximized when opened?
			if (checkWindowMaximized(client)) {
				if (CONFIG_ENABLE_LOGGING) print("NEW WINDOW OPEN IN MAXIMIZED STATE");
				if (CONFIG_MOVE_TO_NEW_DESKTOP_WHEN_STARTED_MAXIMIZED) {
					//move to new desktop
					handleNewDesktopOnMaximized(client, true);
				} else {
					//unmaximize and move to center
					client.setMaximize(false,false);
					const screenGeometry = workspace.activeScreen.geometry;
					const newWidth = screenGeometry.width / 2;
					const newHeight = screenGeometry.height / 2;
					const newX = (screenGeometry.width - newWidth) / 2;
					const newY = (screenGeometry.height - newHeight) / 2;
					client.frameGeometry = {x: newX, y: newY, width: newWidth, height: newHeight};
				}
			}

			client.maximizedChanged.connect(() => {
				onMaximizedChanged(client);
			});
		}

		//connect to fullscreen changed event
		if (client.fullScreenable) {
			//is window fullscreened when opened?
			if (client.fullScreen) {
				if (CONFIG_ENABLE_LOGGING) print("NEW WINDOW OPEN IN FULLSCREEN STATE");
				if (CONFIG_MOVE_TO_NEW_DESKTOP_WHEN_STARTED_FULLSCREENED) {
					//move to new desktop
					handleNewDesktopOnMaximized(client, false);
				}
			}

			client.fullScreenChanged.connect(() => {
				onFullScreenChanged(client);
			});
		}

	if (CONFIG_ADD_ONE_DESKTOP_ON_THE_RIGHT) handleSpareDesktop();
	}
});

// A window removed
workspace.windowRemoved.connect((client) => {
	if (checkNormalClient(client)) {
		// print info
		if (CONFIG_ENABLE_LOGGING) {
			print("======== WINDOW REMOVED ========");
			print("Closed window: " + client.caption);
		}
		onWindowRemoved(client);
	}
});

// Current desktop changed
workspace.currentDesktopChanged.connect((previousDesktop) => {
	if (CONFIG_ENABLE_LOGGING) print("=========== CURRENT DEKSTOP CHANGED ===========")
	if (CONFIG_CLEANUP_EMPTY_DESKTOPS && !animationFixRunning) desktopsCleanup(previousDesktop);
})

// Run desktop cleanup and spare desktop handler on the script startup
if (CONFIG_CLEANUP_EMPTY_DESKTOPS) desktopsCleanup(null);
if (CONFIG_ADD_ONE_DESKTOP_ON_THE_RIGHT) handleSpareDesktop();

// print debug info when the script is started
if (CONFIG_ENABLE_LOGGING) print("================= SCRIPT STARTED ===============");
