const SIP = require('sip.js')
const transform = require('sdp-transform')

let host = '10.13.37.55'
let ua


class Dialer {

    constructor() {
        this.isCalling = false

        this.$ = {}
        this.$.dialer = $('.dialer')
        this.$.status = this.$.dialer.find('.status')
        this.$.dialInput = $('.dial-input')

        this.$.localVideo = $('.local-video')
        this.$.remoteVideo = $('.remote-video')

        this.$.callInput = this.$.dialInput.find('.number')
        this.$.callButton = this.$.dialInput.find('.call')
        this.$.callEndButton = this.$.dialInput.find('.end-call')

        this.$.loginInput = $('.login-input')
        this.$.registerButton = this.$.loginInput.find('.connect')
        this.$.loginUsername = this.$.loginInput.find('.username')
        this.$.loginPw = this.$.loginInput.find('.pw')

        this.$.dialpad = $('.dialpad')

        this.events()
    }


    mediaOptions(audio, video, remoteRender, localRender) {
        return {
            media: {
                constraints: {
                    audio: audio,
                    video: video,
                },
                render: {
                    remote: remoteRender,
                    local: localRender,
                },
            },
        }
    }


    formatSdp(sdpWrapper) {
        let allowedCodecs = ['PCMA', 'PCMU']
        var sdpObj = transform.parse(sdpWrapper.sdp);
        let rtp = {media: [], payloads: []}
        var payloads = []
        for (let codec of sdpObj.media[0].rtp) {
            if (allowedCodecs.includes(codec.codec)) {
                rtp.media.push(codec)
                rtp.payloads.push(codec.payload)
            }
        }
        sdpObj.media[0].rtp.payloads = payloads.join(' ')
        sdpObj.media[0].rtp = rtp.media
        sdpWrapper.sdp = transform.write(sdpObj)
    }


    setCallState(session) {
        this.isCalling = true
        this.$.dialInput.removeClass('no-call').addClass('call')
    }


    unsetCallState(session) {
        this.isCalling = false
        this.$.dialInput.removeClass('call').addClass('no-call')
    }


    setStatus(statusText) {
        this.$.status.text(statusText)
    }


    events() {
        this.$.registerButton.on('click', (e) => {
            ua = new SIP.UA({
                log: {
                    builtinEnabled: false,
                    debug: 'error',
                },
                traceSip: true,
                stunServers: 'stun.l.google.com:19302',
                uri: `sip:${this.$.loginUsername.val()}@${host}`,
                wsServers: [`wss://${host}:7443/ws`],
                authorizationUser: this.$.loginUsername.val(),
                password: this.$.loginPw.val(),
                hackWssInTransport: true,
                hackIpInContact: true,
                rtcpMuxPolicy: 'negotiate',
            })

            // An incoming call. Set the session object and set state to call.
            ua.on('invite', (session) => {
                this.session = session
                this.session.accept()
                this.setStatus('invite')
                this.setCallState(session)

                // Reset call state when the other halve hangs up.
                this.session.on('bye', (request) => {
                    this.setStatus('bye')
                    this.unsetCallState(request)
                })

            })

            ua.on('registered', () => {
                this.setStatus('registered')
                this.$.dialer.removeClass('unregistered').addClass('registered')
            })

            ua.on('unregistered', () => {
                this.setStatus('unregistered')
                this.$.dialer.removeClass('registered').addClass('unregistered')
            })
        })

        // Make a new call.
        this.$.callButton.on('click', (e) => {
            this.session = ua.invite(
                `sip:${this.$.callInput.val()}@${host}`,
                this.mediaOptions(true, true, this.$.remoteVideo.get(0), this.$.localVideo.get(0))
            )

            this.session.mediaHandler.on('getDescription', this.formatSdp)
            // Other end accepted the invite.
            this.session.on('invite', (session) => {
                this.setStatus('invite')
                session.accept()
            })

            this.session.on('accepted', (data) => {
                this.setStatus('accepted')
                this.$.dialInput.removeClass('no-call').addClass('call')
                this.setCallState()
            })

            this.session.on('terminated', (message, cause) => {
                this.setStatus('terminated')
            })

            this.session.on('bye', (request) => {
                this.setStatus('bye')
                this.unsetCallState()
            })
        })

        // End the current session.
        this.$.callEndButton.on('click', (e) => {
            this.session.bye()
        })

        this.$.dialpad.on('click', 'button', (e) => {
            let buttonNumber = $(e.currentTarget).attr('id')

            if (this.isCalling) {
                // Send dtmf tones.
                this.session.dtmf(parseInt(buttonNumber))
            } else {
                this.$.callInput.val(`${this.$.callInput.val()}${buttonNumber}`)
            }
        })
    }
}

window.dialer = new Dialer()
