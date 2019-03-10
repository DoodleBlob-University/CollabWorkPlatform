const ipc = require('electron').ipcRenderer;

const socket = io('http://localhost:4000');
let s_username = 'Joe';
let previousGroup = '';
let currentGroup = '';
let usersTyping = [];
let groupMembers = [];

let currentSprint;
let lastTaskID = 0;

function createGroup(args) {
    //create new group and group tag
    var group = document.createElement('div');
    var groupName = document.createElement('span');

    //set styling attributes and values
    group.setAttribute('class', 'group');
    group.setAttribute('id', 'group');
    group.setAttribute('groupName', args.groupName);
    group.setAttribute('style', 'background-color : ' + args.backgroundColor + '; color : ' + args.fontColor + ';');
    groupName.innerHTML = String(args.groupName).toUpperCase()[0];

    // add elements in correct place in dom
    group.appendChild(groupName);
    $('#addNewGroup').before(group);

    console.log('new group has been added...');
}

//update the scrum task table with a given array of tasks
function updateTaskTable(tasks) {
    //create a new row
    $task_table = $('#task-table');
    $CLONE = $task_table.find('tr.hide')

    if(tasks.length <= 0) {
        lastTaskID = 1;
    }
    else {
        tasks.forEach(task => {
            $row = $CLONE.clone(true).removeClass('hide table-line');
            $row.prop('value', task.id);
            lastTaskID = task.id;

            $row.find('#status').text(task.status);
            $row.find('#desc').text(task.desc);
    
            var $select = $row.find('#assigned').find('select');
    
            groupMembers.forEach(member => {
                let option = document.createElement('option');
                option.value = member;
                option.innerHTML = member;
                $select.append(option);
            })
    
            $select.val(task.assigned);
    
            var $deadline = $row.find('#deadline').find('input');
            // var deadline_date = new Date(task.deadline);
    
            // //refactor date provided to make it suitable for project
            // var day = ('0' + deadline_date.getDate()).slice(-2);
            // var month = ('0' + (deadline_date.getMonth() + 1)).slice(-2);
    
            // deadline_date = deadline_date.getFullYear() + "-" + (day) + "-" + (month);
            $deadline.val(task.deadline);
    
            var $submitted = $row.find('#submitted').find('input');
            //if task has been delievered, set tickbox and create span tag
            if (task.delivered) {
                $submitted.prop('checked', true);
                //add date delivered span here also
            }
    
            //apply styling to each row depending on completion
            if(task.status.includes('late')) {
                $row.addClass('failed');
            } else if(task.status.includes('completed')) {
                $row.addClass('confirmed');
            } else if(task.status.includes('in-progress')) {
                $row.addClass('in-progress');
            }
    
            $task_table.append($row);
        })
    }
    

}

function setStatus(s) {
    $('#status').text(s);

    setTimeout(function () {
        $('#status').text('');
    }, 3000);
}

function UpdateUserTyping() {
    var message = '';
    if (usersTyping.length > 1) {
        usersTyping.forEach(user => {
            message += user + ', ';
        })
        message += ' are typing';
    } else {
        message = usersTyping[0] + ' is typing a message';
    }
    $('#feedback').text(message);
}

function RemoveUserTyping(user) {
    for (let index = 0; index < usersTyping.length; index++) {
        if (usersTyping[index] == user) {
            usersTyping.splice(index, 1);
            break;
        }
    }
}

$(document).ready(function () {
    $("#dialog").dialog({   autoOpen: false,
                            modal: true,
                            resizable: false,
                            buttons: {
                                OK: function() {
                                    $( this ).dialog( "close" );
                                }
                            },
                            hide: {
                                effect: "explode",
                                duration: 200
                            }
    });//initialise dialog

    //load the chat by default
    $('#dynamic-content').load('./Content/Chat.html');

    if (socket !== undefined) {
        socket.on('confirmation', function () {
            //update the user's groups
            socket.emit('fetchUserGroups', s_username);
        });

        //if the user has emitted an announcement, create alert
        //TODO
        //create custom announcement
        socket.on('announcement', function (message, name) {
            //alert(message); //change dialog text
            $('#dialog').dialog('option', 'title', 'Announcement from ' + name);
            $('#dialog').html('<p><span class="ui-icon ui-icon-alert" style="float:left; margin:12px 12px 20px 0;"></span>' + message +'</p>');
            $( '#dialog' ).dialog( 'open' );//open dialog
        });

        //Display who is typing
        socket.on('typing', function (data) {
            if (!usersTyping.includes(data)) {
                usersTyping.push(data);
                UpdateUserTyping();
            }
        });

        //set the user's groups when the connect
        socket.on('updateGroups', function (groups) {
            if (groups.length > 0) {
                //set current group to first group -- maybe change this later to be the 
                //group the user was last in (user settings);
                currentGroup = groups[0].groupName;
                $('#project-name').text(currentGroup);
                //refresh the chat
                socket.emit('refreshChat', currentGroup);
                //set the user's group to the new current group
                socket.emit('group', currentGroup)
                //fetch an array of users for that group
                socket.emit('fetchUserList', currentGroup, function (members) {
                    if (members.length > 0) {
                        groupMembers = members;
                    }
                })
                groups.forEach(group => {
                    createGroup(group);
                })
            }
        });

        //Clear who was typing
        socket.on('clearTyping', function (user) {
            //remove user who was typing
            if (usersTyping.length > 1) {
                RemoveUserTyping();
                UpdateUserTyping();
            } else {
                usersTyping = [];
                $('#feedback').text('');
            }
        });

        //when receiving a new message in your group
        socket.on('output', function (data) {
            var messages = document.getElementById('messages');
            if (data.length) {
                for (var x = 0; x < data.length; x++) {
                    // Build out message div
                    var message = document.createElement('div');
                    var message_content = document.createElement('div');
                    var message_info = document.createElement('div');

                    message.setAttribute('class', 'message');
                    message_content.setAttribute('value', data[x].name);

                    if (data[x].name === s_username) {
                        message_info.setAttribute('class', 'message-info right');
                        message_content.setAttribute('class', 'chat-message self-message');
                    } else {
                        message_info.setAttribute('class', 'message-info');
                        message_content.setAttribute('class', 'chat-message other-message');

                    }
                    message_content.textContent = data[x].message;
                    //add timestamp to message
                    var actualTime = new Date(data[x].timestamp);
                    //if message was not sent on the same day
                    if (actualTime.toLocaleDateString() != new Date(Date.now()).toLocaleDateString()) {
                        //set timestamp to data
                        actualTime = actualTime.toLocaleString();
                    } else {
                        actualTime = "Today, " + actualTime.toLocaleTimeString().substr(0, 5);
                    }
                    message_info.textContent = data[x].name + ' sent - ' + actualTime;

                    
                    message.appendChild(message_info);
                    message.appendChild(message_content);
                    //message_content.appendChild(message_info);
                    messages.appendChild(message);
                    messages.insertBefore(message, messages.lastChild);
                }

                messages.scrollTop = messages.scrollHeight;

            } else {
                var message = document.createElement('div');
                message.setAttribute('class', 'chat-message');
                message.textContent = "Chat history not available";
                messages.appendChild(message);
                messages.insertBefore(message, messages.firstChild);
            }
        });

        //update the frontend scrum table with given task array
        socket.on('updateScrum', function (sprint, tasks) {
            //clear task table
            if(sprint == currentSprint) {
                updateTaskTable(tasks);
            }
            
        });

        // Get Status From Server
        socket.on('status', function (data) {
            setStatus((typeof data === 'object') ? data.message : data);
        });
    }

    //dynamically load the content when clicking on a navigation link
    $(document).on('click', '#navigator a', function (e) {
        e.preventDefault();

        $('#dynamic-content').load(e.target.href);

        if (e.target.href.includes('Chat')) {
            socket.emit('refreshChat', currentGroup);
        } else if (e.target.href.includes('Scrum')) {
            currentSprint = 'product backlog';
            socket.emit('refreshScrum', currentGroup, currentSprint);
        } else if (e.target.href.includes('Kanban')) {
            //socket.emit('refreshKanban', currentGroup);
        } else if (e.target.href.includes('Profile')){
            $("#username").html(" Exercises Solution");
        }
    })

    //when you join a group you are part of
    $(document).on('click', '#group', function () {
        var group = $(this).attr('groupname');
        previousGroup = currentGroup;
        currentGroup = group;

        //update group to new group
        socket.emit('group', group, previousGroup, );
        //fetch userlist for new group
        socket.emit('fetchUserList', currentGroup, function (members) {
            if (members.length > 0) {
                groupMembers = members;
            }
        })
        //update group tag
        $('#project-name').text(group);

        //load the chat when the user swaps group
        $('#dynamic-content').load('./Content/Chat.html');

        socket.emit('refreshChat', group);

        $('#project-name').text(group);
    })

    //create group creator window when clicking on add new group button
    $('#addNewGroup').on('click', function () {
        $('#page-mask').fadeTo(500, 0.7);
        ipc.send('createGroupWindow');
    })

    //create a new group
    ipc.on('addNewGroup', (event, args) => {
        //only create group if succesfully created
        socket.emit('checkGroupExists', args.groupName, function (data) {
            if (!data) {
                // create core group data document
                socket.emit('createGroup', args, s_username, function (success) {
                    if (success) {
                        //create front end grouping
                        createGroup(args);
                        alert('group succesfully created!');
                    } else {
                        alert('group could not be created!');
                    }
                });
            } else {
                alert('A group with that name already exists!');
            }
        });
    })

    ipc.on('addNewSprint', (event, data) => {
        socket.emit('createSprint', data, currentGroup, function(success) {
            if(success) {
                alert('created new sprint');
            }
        })
    })

    //get console updates from app
    ipc.on('update', (event, args) => {
        console.log(args);
    })

    //fades the background to make popup window more prominent
    ipc.on('fadeMask', (event, args) => {
        $('#page-mask').fadeOut(500);
    })

});