var express = require('express');
var app = express();
var server = require('http').createServer(app);
var port = process.env.PORT || 3000;

server.listen(port, function() {
  console.log('Server listening at port %d', port);
});

app.use(express.static(__dirname + '/public'));

var io = require('socket.io')(server);
var numUsers = 0;

io.on('connection', function(socket) {
  var addedUser = false;

  // 监听客户端触发的响应事件“new message”
  socket.on('new message', function(data) {
    // 当客户端触发 “new message” 事件，那么服务器将其广播到所有的客户端，并触发客户端
    // 监听的 “new message” 事件
    socket.broadcast.emit('new message', {
      username: socket.username,
      message: data
    });
  });

  // 监听客户端触发的 “add user” 这个事件
  socket.on('add user', function(username) {
    if (addedUser) return;

    // 我们把 username 存储到当前用户的 session 当中
    socket.username = username;
    ++numUsers;
    addedUser = true;

    console.log('[' + new Date().getTime() + '] ' + username + ' login in.');

    socket.emit('login', {
      numUsers: numUsers
    });

    // 当客户端触发了 “add user” 之后，服务器将其广播给所有的客户端，触发 客户端的
    // “user joined” 事件
    socket.broadcast.emit('user joined', {
      username: socket.username,
      numUsers: numUsers
    });
  });

  // 当客户端触发 “typing” 事件时，将其 “正在输入……” 的状态广播给所有的客户端，触发
  // 其他客户端中的 “typing” 事件
  socket.on('typing', function() {
    socket.broadcast.emit('typing', {
      username: socket.username
    });
  });

  // 当客户端触发了 “stop typing” 事件，服务器将其广播给所有客户端，触发客户端的
  // “stop typing” 事件
  socket.on('stop typing', function() {
    socket.broadcast.emit('stop typing', {
      username: socket.username
    });
  });

  // 监听用户断掉连接，触发 “disconnect” 事件的时候
  socket.on('disconnect', function() {
    if (addedUser) {
      --numUsers;

      // 告诉所有其他的客户端当前用户退出了并触发事件 “user left”
      socket.broadcast.emit('user left', {
        username: socket.username,
        numUsers: numUsers
      });
    }
  });
});
