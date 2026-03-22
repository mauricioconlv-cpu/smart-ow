'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'

// ─── Types ────────────────────────────────────────────────────────────────────
export type PttMode =
  | 'idle'
  | 'connecting'   // trying WebRTC handshake
  | 'streaming'    // WebRTC active (sending OR receiving)
  | 'receiving'    // WebRTC — this peer is the listener
  | 'recording'    // async fallback — recording locally
  | 'uploading'    // uploading blob to storage

export interface UsePttSessionOptions {
  serviceId: string | null | undefined
  role: 'operator' | 'dispatcher'
}

export interface UsePttSessionReturn {
  mode: PttMode
  startPtt: () => Promise<void>
  stopPtt: () => Promise<void>
  transcript: string
  incomingActive: boolean  // true when receiving a peer's stream
  isPeerPresent: boolean   // true when the other role has the same expediente open
}

// ─── Constants ────────────────────────────────────────────────────────────────
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]
const WEBRTC_TIMEOUT_MS = 3500  // wait for peer answer before falling back

// ─── Supabase client (module-level, created once) ────────────────────────────
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function usePttSession({ serviceId, role }: UsePttSessionOptions): UsePttSessionReturn {
  const [mode, setMode]               = useState<PttMode>('idle')
  const [transcript, setTranscript]   = useState('')
  const [incomingActive, setIncoming] = useState(false)
  const [isPeerPresent, setPeerPresent] = useState(false)

  // Refs — not triggering re-renders
  const pcRef              = useRef<RTCPeerConnection | null>(null)
  const localStreamRef     = useRef<MediaStream | null>(null)
  const remoteAudioRef     = useRef<HTMLAudioElement | null>(null)
  const recorderRef        = useRef<MediaRecorder | null>(null)
  const chunksRef          = useRef<Blob[]>([])
  const recognitionRef     = useRef<any>(null)
  const channelRef         = useRef<any>(null)
  const connectTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isWebRtcConnected  = useRef(false)
  const transcriptAccum    = useRef('')

  // ── Remote audio element ────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return
    remoteAudioRef.current = new Audio()
    remoteAudioRef.current.autoplay = true
    return () => { remoteAudioRef.current = null }
  }, [])

  // ── Signaling + Presence channel ───────────────────────────────────────
  useEffect(() => {
    if (!serviceId) return

    const peerRole = role === 'operator' ? 'dispatcher' : 'operator'

    const ch = supabase.channel(`ptt:${serviceId}`, {
      config: {
        broadcast: { self: false },
        presence:  { key: role },
      },
    })

    // ── Presence: track when this peer joins/leaves ─────────────────────
    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState<{ role: string }>()
      const peerKeys = Object.keys(state).filter(k => k !== role)
      const peerOnline = peerKeys.some(k =>
        (state[k] as any[]).some((p: any) => p.role === peerRole)
      )
      setPeerPresent(peerOnline)
    })

    // Receive offer from peer → answer it
    ch.on('broadcast', { event: 'ptt:offer' }, async ({ payload }) => {
      if (payload.role === role) return  // ignore own role
      try {
        const pc = buildPeerConnection(ch)
        pcRef.current = pc
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        ch.send({ type: 'broadcast', event: 'ptt:answer', payload: { sdp: answer, role } })
        setMode('receiving')
        setIncoming(true)
      } catch (e) { console.error('[PTT] answer error', e) }
    })

    // Receive answer to our offer → finalize WebRTC
    ch.on('broadcast', { event: 'ptt:answer' }, async ({ payload }) => {
      if (payload.role === role) return
      try {
        await pcRef.current?.setRemoteDescription(new RTCSessionDescription(payload.sdp))
        isWebRtcConnected.current = true
        if (connectTimerRef.current) { clearTimeout(connectTimerRef.current); connectTimerRef.current = null }
        setMode('streaming')
      } catch (e) { console.error('[PTT] set answer error', e) }
    })

    // ICE candidates
    ch.on('broadcast', { event: 'ptt:ice' }, async ({ payload }) => {
      if (payload.role === role) return
      try { await pcRef.current?.addIceCandidate(new RTCIceCandidate(payload.candidate)) } catch {}
    })

    // Peer ended their broadcast
    ch.on('broadcast', { event: 'ptt:stop' }, ({ payload }) => {
      if (payload.role === role) return
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null
      setIncoming(false)
      if (mode === 'receiving') setMode('idle')
    })

    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        // Announce presence
        await ch.track({ role })
      }
    })
    channelRef.current = ch

    return () => {
      ch.untrack()
      supabase.removeChannel(ch)
      channelRef.current = null
      setPeerPresent(false)
    }
  }, [serviceId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Helper: build RTCPeerConnection ────────────────────────────────────
  function buildPeerConnection(ch: any) {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) ch.send({ type: 'broadcast', event: 'ptt:ice', payload: { candidate, role } })
    }

    pc.ontrack = (evt) => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = evt.streams[0]
        setMode('receiving')
        setIncoming(true)
      }
    }

    pc.onconnectionstatechange = () => {
      if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
        setIncoming(false)
        if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null
      }
    }

    return pc
  }

  // ── Speech Recognition ──────────────────────────────────────────────────
  function startRecognition() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return
    const r = new SR()
    r.lang = 'es-MX'
    r.continuous = true
    r.interimResults = false
    r.onresult = (e: any) => {
      const t = Array.from(e.results as any[]).map((res: any) => res[0].transcript).join(' ')
      transcriptAccum.current = t
      setTranscript(t)
    }
    try { r.start() } catch {}
    recognitionRef.current = r
  }

  function stopRecognition(): string {
    try { recognitionRef.current?.stop() } catch {}
    recognitionRef.current = null
    return transcriptAccum.current
  }

  // ── Upload blob + log ───────────────────────────────────────────────────
  // peerWasPresent: when true → WebRTC was live (audio_ptt); false → voicemail
  async function uploadAndLog(blob: Blob, finalTranscript: string, peerWasPresent: boolean) {
    if (!serviceId) return
    setMode('uploading')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('no auth')

      const logType    = peerWasPresent ? 'audio_ptt'    : 'voicemail_ptt'
      const eventLabel = role === 'operator'
        ? (peerWasPresent ? '🎤 Operador — voz en vivo' : '📩 Operador — buzón de voz')
        : (peerWasPresent ? '🎧 Cabina — voz en vivo'   : '📬 Cabina — mensaje de voz')

      const fileName = `${serviceId}/${Date.now()}_${role}.webm`
      const { error: upErr } = await supabase.storage
        .from('audios')
        .upload(fileName, blob, { contentType: 'audio/webm' })
      if (upErr) throw upErr

      const { data: { publicUrl } } = supabase.storage.from('audios').getPublicUrl(fileName)

      await supabase.from('service_logs').insert({
        service_id:  serviceId,
        created_by:  user.id,
        type:        logType,
        note:        finalTranscript.trim() || '[Audio sin transcripción]',
        resource_url: publicUrl,
        actor_role:  role,
        event_label: eventLabel,
      })
    } catch (e: any) {
      console.error('[PTT] upload error:', e.message)
    } finally {
      setMode('idle')
      setTranscript('')
      transcriptAccum.current = ''
    }
  }

  // ── startPtt ────────────────────────────────────────────────────────────
  const startPtt = useCallback(async () => {
    if (!serviceId || mode !== 'idle') return

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      localStreamRef.current = stream
      startRecognition()

      // Always record locally (async fallback / always logs to bitácora)
      chunksRef.current = []
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg'
      const recorder = new MediaRecorder(stream, { mimeType })
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.start()
      recorderRef.current = recorder

      setMode('connecting')
      isWebRtcConnected.current = false

      // Try WebRTC only if peer is present
      const ch = channelRef.current
      if (ch && isPeerPresent) {
        const pc = buildPeerConnection(ch)
        pcRef.current = pc
        stream.getTracks().forEach(t => pc.addTrack(t, stream))
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        ch.send({ type: 'broadcast', event: 'ptt:offer', payload: { sdp: offer, role } })

        // Fallback timer — if peer doesn't answer in time → record mode
        connectTimerRef.current = setTimeout(() => {
          if (!isWebRtcConnected.current) {
            console.log('[PTT] No peer answered — async mode')
            setMode('recording')
          }
          connectTimerRef.current = null
        }, WEBRTC_TIMEOUT_MS)
      } else {
        // Peer not in expediente → go straight to recording (voicemail)
        setMode('recording')
      }
    } catch (e: any) {
      console.error('[PTT] startPtt error:', e.message)
      if (e.name === 'NotAllowedError') alert('Permiso de micrófono necesario.')
      setMode('idle')
    }
  }, [serviceId, mode, role, isPeerPresent]) // eslint-disable-line react-hooks/exhaustive-deps

  // snapshot peer presence at the moment the button was pressed
  const peerPresentAtStart = useRef(false)

  const startPttWrapped = useCallback(async () => {
    peerPresentAtStart.current = isPeerPresent
    await startPtt()
  }, [startPtt, isPeerPresent])

  // ── stopPtt ─────────────────────────────────────────────────────────────
  const stopPtt = useCallback(async () => {
    if (connectTimerRef.current) { clearTimeout(connectTimerRef.current); connectTimerRef.current = null }

    // Notify peer we're done
    channelRef.current?.send({ type: 'broadcast', event: 'ptt:stop', payload: { role } })

    // Close WebRTC
    pcRef.current?.close()
    pcRef.current = null
    const wasLive = isWebRtcConnected.current
    isWebRtcConnected.current = false

    // Stop mic stream
    localStreamRef.current?.getTracks().forEach(t => t.stop())
    localStreamRef.current = null

    const finalTranscript = stopRecognition()

    // Stop recorder and upload
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        if (blob.size > 500) {  // skip tiny blobs (accidental taps)
          await uploadAndLog(blob, finalTranscript, wasLive || peerPresentAtStart.current)
        } else {
          setMode('idle')
        }
      }
      recorder.stop()
    } else {
      setMode('idle')
    }
    recorderRef.current = null
  }, [role]) // eslint-disable-line react-hooks/exhaustive-deps

  return { mode, startPtt: startPttWrapped, stopPtt, transcript, incomingActive, isPeerPresent }
}
