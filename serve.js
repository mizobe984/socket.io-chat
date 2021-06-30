const crypto = require('crypto')

const DOCUMENT_ROOT = `${__dirname}/public`

const SECRET_TOKEN = 'abcdefghijklmn12345'

const MEMBER = {}
let MEMBER_COUNT = 1

const app = require('express')()

/**
 * "/"にアクセスがあったらindex.htmlを返却
 */
app.get('/', (req, res) => {
  res.sendFile(`${DOCUMENT_ROOT}/index.html`)
})
/**
 * その他のファイルへのアクセス
 */
app.get('/:file', (req, res) => {
  res.sendFile(`${DOCUMENT_ROOT}/${req.params.file}`)
})

const server = require('http').createServer(app)
const io = require('socket.io')(server)

/**
 * [イベント] ユーザーが接続
 */
io.on('connection', (socket) => {
  console.log('ユーザーが接続しました')

  const token = makeToken(socket.id)

  MEMBER[socket.id] = {
    token: token,
    name: null,
    count: MEMBER_COUNT++,
  }

  // 本人にトークンを送付
  io.to(socket.id).emit('token', { token: token })

  socket.on('join', (data) => {
    //--------------------------
    // トークンが正しければ
    //--------------------------
    if (authToken(socket.id, data.token)) {
      // 入室OK + 現在の入室者一覧を通知
      const memberlist = getMemberList()
      io.to(socket.id).emit('join-result', { status: true, list: memberlist })

      // メンバー一覧に追加
      MEMBER[socket.id].name = data.name

      // 入室通知
      io.to(socket.id).emit('member-join', data)
      socket.broadcast.emit('member-join', { name: data.name, token: MEMBER[socket.id].count })
    }
    //--------------------------
    // トークンが誤っていた場合
    //--------------------------
    else {
      // 本人にNG通知
      io.to(socket.id).emit('join-result', { status: false })
    }
  })

  // 発言を全員に中継
  socket.on('post', (data) => {
    if (authToken(socket.id, data.token)) {
      // 本人に通知
      io.to(socket.id).emit('member-post', data)

      // 本人以外に通知
      socket.broadcast.emit('member-post', { text: data.text, token: MEMBER[socket.id].count })
    }
  })

  socket.on('quit', (data) => {
    //--------------------------
    // トークンが正しければ
    //--------------------------
    if (authToken(socket.id, data.token)) {
      // 本人に通知
      io.to(socket.id).emit('quit-result', { status: true })

      // 本人以外に通知
      socket.broadcast.emit('member-quit', { token: MEMBER[socket.id].count })

      // 削除
      delete MEMBER[socket.id]
    }
    //--------------------------
    // トークンが誤っていた場合
    //--------------------------
    else {
      // 本人にNG通知
      io.to(socket.id).emit('quit-result', { status: false })
    }
  })
})

/**
 * 3000番でサーバを起動する
 */
server.listen(3000, () => {
  console.log('listening on *:3000')
})

/**
 * トークンを作成する
 * @param {string} id - socket.id
 * @returns string
 */
const makeToken = (id) => crypto.createHash('sha1').update(`${SECRET_TOKEN}${id}`).digest('hex')

/**
 * 本人からの通信か確認する
 * @param {string} socketid
 * @param {string} token
 * @returns boolean
 */
const authToken = (socketid, token) => socketid in MEMBER && token === MEMBER[socketid].token

/**
 * メンバー一覧を取得する
 * @returns array
 */
const getMemberList = () => {
  const list = []
  for (let key in MEMBER) {
    const cur = MEMBER[key]
    if (cur.name !== null) {
      list.push({ token: cur.count, name: cur.name })
    }
  }
  return list
}
