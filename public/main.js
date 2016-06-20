$(function() {
  localStorage.debug = false;

  var FADE_TIME = 150; // ms
  var TYPING_TIMER_LENGTH = 400; // ms

  // Initialize variables
  var $window = $(window);
  var $usernameInput = $('.usernameInput'); // 输入用户名
  var $messages = $('.messages'); // 消息列表
  var $inputMessage = $('.inputMessage'); // Input message input box

  var $loginPage = $('.login.page'); // 登录页
  var $chatPage = $('.chat.page'); // 聊天页

  // 初始化状态
  var username = '';
  var connected = false;
  var typing = false;
  var lastTypingTime;
  var $currentInput = $usernameInput.focus();

  var socket = io();

  function addParticipantsMessage(data) {
    var message = '';
    message += "现有 " + data.numUsers + " 人加入聊天室";
    log(message);
  }

  // 读取用户在登陆页输入的用户名并与server通信添加当前用户
  function setUsername() {
    username = cleanInput($usernameInput.val().trim());
    login();
  }

  function login() {
    $loginPage.fadeOut();
    $chatPage.show();
    $loginPage.off('click');
    $currentInput = $inputMessage.focus();

    // 通知服务器添加当前用户到通信中，并告知当前会话的用户名
    socket.emit('add user', username);
  }

  /**
   * 发送消息
   */
  function sendMessage() {
    var message = $inputMessage.val();
    // 防止用户输入特殊 html 标签符号
    message = cleanInput(message);
    // 如果消息内容不为空且连接上了服务器
    if (message && connected) {
      $inputMessage.val('');
      addChatMessage({
        username: username,
        message: message
      });
      //通知服务器收到了新的消息并将其转播给其他加入了聊天室的用户
      socket.emit('new message', message);
    }
  }

  // 记录信息
  function log(message, options) {
    var $el = $('<li>').addClass('log').text(message);
    addMessageElement($el, options);
  }

  // 在当前页面显示已经发送的消息
  function addChatMessage(data, options) {
    // Don't fade the message in if there is an 'X was typing'
    var $typingMessages = getTypingMessages(data);
    options = options || {};
    if ($typingMessages.length !== 0) {
      options.fade = false;
      $typingMessages.remove();
    }

    var $message = template(data.username == username ? 'messageMe' : 'messageOthers', data);

    addMessageElement($message, options);
  }

  // 为其他用户提示当前有用户正在输入
  function addChatTyping(data) {
    data.typing = true;
    data.message = '正在输入……';
    addChatMessage(data);
  }

  // 移除 [正在输入……] 的提示信息
  function removeChatTyping(data) {
    getTypingMessages(data).fadeOut(function() {
      $(this).remove();
    });
  }

  // Adds a message element to the messages and scrolls to the bottom
  // el - The element to add as a message
  // options.fade - If the element should fade-in (default = true)
  // options.prepend - If the element should prepend
  //   all other messages (default = false)
  function addMessageElement(el, options) {
    var $el = $(el);

    // Setup default options
    if (!options) {
      options = {};
    }
    if (typeof options.fade === 'undefined') {
      options.fade = true;
    }
    if (typeof options.prepend === 'undefined') {
      options.prepend = false;
    }

    // Apply options
    if (options.fade) {
      $el.hide().fadeIn(FADE_TIME);
    }
    if (options.prepend) {
      $messages.prepend($el);
    } else {
      $messages.append($el);
    }
    $messages[0].scrollTop = $messages[0].scrollHeight;
  }

  /**
   * 防止输入中带有非法的标记符号
   * @param input 输入的字符串
   * @returns {XMLList|jQuery}
   */
  function cleanInput(input) {
    return $('<span/>').text(input).text();
  }

  /**
   * 更新 [正在输入] 事件
   */
  function updateTyping() {
    if (connected) {
      if (!typing) {
        typing = true;
        socket.emit('typing');
      }
      lastTypingTime = (new Date()).getTime();

      setTimeout(function() {
        var typingTimer = (new Date()).getTime();
        var timeDiff = typingTimer - lastTypingTime;
        if (timeDiff >= TYPING_TIMER_LENGTH && typing) {
          socket.emit('stop typing');
          typing = false;
        }
      }, TYPING_TIMER_LENGTH);
    }
  }

  /**
   * 得到 [“某某”正在输入……] 的信息
   * @param data 包含 username 的 object 对象
   * @returns {Array.<T>|*|jQuery}
   */
  function getTypingMessages(data) {
    return $('.typing.message').filter(function() {
      return $(this).data('username') !== data.username;
    });
  }

  $window.keydown(function(event) {

    // 当键入一个按键的时候，当前的属输入框自动获得焦点
    if (!(event.ctrlKey || event.metaKey || event.altKey)) {
      $currentInput.focus();
    }

    // 当用户键入 “Enter” 键的时候
    if (event.which === 13) {
      if (username) {
        sendMessage();
        socket.emit('stop typing');
        typing = false;
      } else {
        setUsername();
      }
    }
  });

  $inputMessage.on('input', function() {
    updateTyping();
  });

  // 点击事件

  // 当点击登录页面时，
  $loginPage.click(function() {
    $currentInput.focus();
  });

  // 当点击输入消息的框的时候，消息输入框获取焦点
  $inputMessage.click(function() {
    $inputMessage.focus();
  });

  // socket 事件

  // 当服务器触发 “login” 事件的时候执行以下操作
  socket.on('login', function(data) {
    connected = true;
    // Display the welcome message
    var message = "欢迎来到聊天室";
    log(message, {
      prepend: true
    });
    addParticipantsMessage(data);
  });

  // 当服务器触发 “new message” 事件的时候，添加消息内容到页面中
  socket.on('new message', function(data) {
    addChatMessage(data);
  });

  // 当服务器触发 “user joined” 事件的时候，记录并输出到页面中
  socket.on('user joined', function(data) {
    log(data.username + ' 已加入');
    addParticipantsMessage(data);
  });

  // 当服务器触发 “user left” 事件的时候，记录并显示退出了的用户信息
  socket.on('user left', function(data) {
    log(data.username + ' 已离开');
    addParticipantsMessage(data);
    removeChatTyping(data);
  });

  // 当服务器触发 “typing” 事件的时候，为当前正在输入的用户添加“正在输入……”的气泡
  socket.on('typing', function(data) {
    addChatTyping(data);
  });

  // 当服务器触发 “stop typing” 事件的时候，为当前正在输入的用户添加“正在输入……”的气泡
  socket.on('stop typing', function(data) {
    removeChatTyping(data);
  });

});
