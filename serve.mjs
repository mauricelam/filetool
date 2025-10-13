import finalhandler from 'finalhandler'
import { createServer } from 'http'
import serveStatic from 'serve-static'

const serve = serveStatic('./dist', {
  setHeaders: setHeaders
})

function setHeaders(res, path) {
  console.log(`Served ${path}`)
  if (path.indexOf('/ffmpeg/') > -1) {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
  }
}

// Create server
const server = createServer(function onRequest(req, res) {
  serve(req, res, finalhandler(req, res))
})

// Listen
server.listen(8080)
console.log('Serving at port 8080...')
