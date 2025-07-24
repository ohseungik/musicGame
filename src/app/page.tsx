"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Play, Pause, RotateCcw, Music, Gamepad2, FastForward } from "lucide-react"
import { toast } from "sonner"

interface Note {
  id: number
  lane: number
  startTime: number
  currentY: number
  element?: HTMLDivElement
  hit: boolean
}

interface GameStats {
  score: number
  combo: number
  maxCombo: number
  perfect: number
  good: number
  miss: number
}

const LANES = 4
const BASE_NOTE_SPEED = 350 // pixels per second (기본 속도)
const JUDGMENT_LINE_Y = 500
const PERFECT_THRESHOLD = 40
const GOOD_THRESHOLD = 80
const GAME_HEIGHT = 600

export default function RhythmGame() {
  const [gameState, setGameState] = useState<"menu" | "playing" | "paused" | "ended">("menu")
  const [notes, setNotes] = useState<Note[]>([])
  const [stats, setStats] = useState<GameStats>({
    score: 0,
    combo: 0,
    maxCombo: 0,
    perfect: 0,
    good: 0,
    miss: 0,
  })
  const [pressedKeys, setPressedKeys] = useState<Set<number>>(new Set())
  const [judgment, setJudgment] = useState<{ text: string; color: string } | null>(null)
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1) // 배속 상태 추가

  const gameAreaRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<number>(0)
  const startTimeRef = useRef<number>(0)
  const pauseTimeRef = useRef<number>(0)
  const noteIdRef = useRef(0)
  const notesMapRef = useRef<Map<number, HTMLDivElement>>(new Map())

  // 샘플 노트 패턴 생성
  const generateNotes = useCallback(() => {
    const newNotes: Note[] = []
    const patterns = [
      [0],
      [1],
      [2],
      [3], // 단일 노트
      [0, 2],
      [1, 3],
      [0, 3],
      [1, 2], // 더블 노트
      [0, 1],
      [1, 2],
      [2, 3], // 인접 더블
      [0, 1, 2],
      [1, 2, 3], // 트리플 노트
    ]

    for (let time = 3000; time < 90000; time += 400 + Math.random() * 600) {
      const pattern = patterns[Math.floor(Math.random() * patterns.length)]

      pattern.forEach((lane) => {
        newNotes.push({
          id: noteIdRef.current++,
          lane,
          startTime: time,
          currentY: -100,
          hit: false,
        })
      })
    }

    return newNotes.sort((a, b) => a.startTime - b.startTime)
  }, [])

  // 노트 DOM 요소 생성
  const createNoteElement = useCallback((note: Note) => {
    const element = document.createElement("div")
    element.className = `absolute rounded-lg border-2 border-white z-10 shadow-lg`
    element.style.width = `calc(${100 / LANES}% - 8px)`
    element.style.height = "36px"
    element.style.left = `calc(${(note.lane * 100) / LANES}% + 4px)`
    element.style.transform = "translateY(-100px)"
    element.style.willChange = "transform"
    element.style.transition = "opacity 0.2s ease-out"

    // 레인별 색상
    const colors = ["bg-red-500", "bg-blue-500", "bg-green-500", "bg-yellow-500"]
    element.classList.add(colors[note.lane])

    return element
  }, [])

  // 키 입력 처리
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (gameState !== "playing") return

      const keyMap: { [key: string]: number } = {
        KeyA: 0,
        ArrowLeft: 0,
        KeyS: 1,
        ArrowDown: 1,
        KeyD: 2,
        ArrowUp: 2,
        KeyF: 3,
        ArrowRight: 3,
      }

      const lane = keyMap[event.code]
      if (lane !== undefined && !pressedKeys.has(lane)) {
        setPressedKeys((prev) => new Set(prev).add(lane))
        checkNoteHit(lane)
      }
    },
    [gameState, pressedKeys, notes],
  )

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    const keyMap: { [key: string]: number } = {
      KeyA: 0,
      ArrowLeft: 0,
      KeyS: 1,
      ArrowDown: 1,
      KeyD: 2,
      ArrowUp: 2,
      KeyF: 3,
      ArrowRight: 3,
    }

    const lane = keyMap[event.code]
    if (lane !== undefined) {
      setPressedKeys((prev) => {
        const newSet = new Set(prev)
        newSet.delete(lane)
        return newSet
      })
    }
  }, [])

  // 노트 히트 체크 (위치 기반)
  const checkNoteHit = useCallback(
    (lane: number) => {
      // 해당 레인의 활성 노트들 중 판정선에 가장 가까운 노트 찾기
      const laneNotes = notes.filter(
        (note) =>
          note.lane === lane &&
          !note.hit &&
          note.currentY > JUDGMENT_LINE_Y - GOOD_THRESHOLD &&
          note.currentY < JUDGMENT_LINE_Y + GOOD_THRESHOLD,
      )

      if (laneNotes.length === 0) return

      // 판정선에 가장 가까운 노트 선택
      const closestNote = laneNotes.reduce((closest, note) => {
        const currentDistance = Math.abs(note.currentY - JUDGMENT_LINE_Y)
        const closestDistance = Math.abs(closest.currentY - JUDGMENT_LINE_Y)
        return currentDistance < closestDistance ? note : closest
      })

      const distance = Math.abs(closestNote.currentY - JUDGMENT_LINE_Y)

      let judgmentText = ""
      let judgmentColor = ""
      let scoreAdd = 0

      if (distance < PERFECT_THRESHOLD) {
        judgmentText = "PERFECT!"
        judgmentColor = "text-yellow-400"
        scoreAdd = 1000
        setStats((prev) => ({
          ...prev,
          perfect: prev.perfect + 1,
          combo: prev.combo + 1,
          score: prev.score + scoreAdd * Math.max(1, Math.floor(prev.combo / 10) + 1),
        }))
      } else if (distance < GOOD_THRESHOLD) {
        judgmentText = "GOOD"
        judgmentColor = "text-green-400"
        scoreAdd = 500
        setStats((prev) => ({
          ...prev,
          good: prev.good + 1,
          combo: prev.combo + 1,
          score: prev.score + scoreAdd * Math.max(1, Math.floor(prev.combo / 10) + 1),
        }))
      }

      if (judgmentText) {
        setJudgment({ text: judgmentText, color: judgmentColor })
        setTimeout(() => setJudgment(null), 500)

        // 노트 제거 애니메이션
        const element = notesMapRef.current.get(closestNote.id)
        if (element) {
          element.style.transform = `translateY(${closestNote.currentY}px) scale(1.3) rotate(15deg)`
          element.style.opacity = "0"
          setTimeout(() => {
            if (element.parentNode) {
              element.remove()
            }
            notesMapRef.current.delete(closestNote.id)
          }, 200)
        }

        setNotes((prev) => prev.map((note) => (note.id === closestNote.id ? { ...note, hit: true } : note)))
      }
    },
    [notes],
  )

  // 부드러운 애니메이션 루프
  const gameLoop = useCallback(
    (timestamp: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp - pauseTimeRef.current
      }

      const elapsed = timestamp - startTimeRef.current

      // 노트 위치 업데이트
      setNotes((prevNotes) => {
        return prevNotes.map((note) => {
          if (note.hit) return note

          const noteTime = elapsed - note.startTime
          // 배속 적용
          const newY = (noteTime / 1000) * BASE_NOTE_SPEED * speedMultiplier

          return { ...note, currentY: newY }
        })
      })

      // DOM 요소 위치 업데이트
      notes.forEach((note) => {
        if (note.hit) return

        const element = notesMapRef.current.get(note.id)
        if (element && note.currentY > -100 && note.currentY < GAME_HEIGHT + 100) {
          element.style.transform = `translateY(${note.currentY}px)`
        }

        // Miss 체크
        if (note.currentY > JUDGMENT_LINE_Y + GOOD_THRESHOLD && !note.hit) {
          setStats((prev) => ({
            ...prev,
            miss: prev.miss + 1,
            combo: 0,
            maxCombo: Math.max(prev.maxCombo, prev.combo),
          }))

          // Miss 애니메이션
          if (element) {
            element.style.opacity = "0.3"
            element.style.transform = `translateY(${note.currentY}px) scale(0.8)`
            setTimeout(() => {
              if (element.parentNode) {
                element.remove()
              }
              notesMapRef.current.delete(note.id)
            }, 300)
          }

          setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, hit: true } : n)))
        }
      })

      // 새로운 노트 생성
      const activeNotes = notes.filter((note) => {
        return note.currentY > -150 && note.currentY < GAME_HEIGHT + 100 && !note.hit
      })

      activeNotes.forEach((note) => {
        if (!notesMapRef.current.has(note.id) && gameAreaRef.current) {
          const element = createNoteElement(note)
          gameAreaRef.current.appendChild(element)
          notesMapRef.current.set(note.id, element)
        }
      })

      // 화면 밖 노트 정리
      notesMapRef.current.forEach((element, noteId) => {
        const note = notes.find((n) => n.id === noteId)
        if (!note || note.currentY > GAME_HEIGHT + 100) {
          if (element.parentNode) {
            element.remove()
          }
          notesMapRef.current.delete(noteId)
        }
      })

      if (gameState === "playing") {
        animationRef.current = requestAnimationFrame(gameLoop)
      }
    },
    [gameState, notes, createNoteElement, speedMultiplier], // speedMultiplier 의존성 추가
  )

  // 게임 시작
  const startGame = () => {
    // 기존 노트 정리
    notesMapRef.current.forEach((element) => {
      if (element.parentNode) {
        element.remove()
      }
    })
    notesMapRef.current.clear()

    const newNotes = generateNotes()
    setNotes(newNotes)
    setStats({
      score: 0,
      combo: 0,
      maxCombo: 0,
      perfect: 0,
      good: 0,
      miss: 0,
    })
    startTimeRef.current = 0
    pauseTimeRef.current = 0
    setGameState("playing")

    toast(`현재 배속: ${speedMultiplier}x. A, S, D, F 키 또는 화살표 키를 사용하세요`);
  }

  // 게임 일시정지/재개
  const togglePause = () => {
    if (gameState === "playing") {
      setGameState("paused")
      if (startTimeRef.current) {
        pauseTimeRef.current = performance.now() - startTimeRef.current
      }
    } else if (gameState === "paused") {
      setGameState("playing")
      startTimeRef.current = 0
    }
  }

  // 게임 재시작
  const resetGame = () => {
    setGameState("menu")
    setNotes([])
    startTimeRef.current = 0
    pauseTimeRef.current = 0

    // 모든 노트 DOM 요소 정리
    notesMapRef.current.forEach((element) => {
      if (element.parentNode) {
        element.remove()
      }
    })
    notesMapRef.current.clear()

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }
  }

  // 이벤트 리스너 등록
  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [handleKeyDown, handleKeyUp])

  // 게임 루프 시작
  useEffect(() => {
    if (gameState === "playing") {
      animationRef.current = requestAnimationFrame(gameLoop)
    } else if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [gameState, gameLoop])

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      notesMapRef.current.forEach((element) => {
        if (element.parentNode) {
          element.remove()
        }
      })
      notesMapRef.current.clear()
    }
  }, [])

  const laneColors = ["bg-red-500", "bg-blue-500", "bg-green-500", "bg-yellow-500"]
  const keyLabels = ["A", "S", "D", "F"]

  return (
    <div className="min-h-screen bg-black text-white p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            리듬 게임
          </h1>
          <p className="text-lg text-gray-300">A, S, D, F 키 또는 화살표 키를 사용하여 떨어지는 노트를 맞춰보세요!</p>
        </div>

        {gameState === "menu" && (
          <Card className="bg-gray-900 border-gray-700">
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2 text-white">
                <Music className="w-6 h-6" />
                게임 시작
              </CardTitle>
              <CardDescription className="text-gray-300">리듬에 맞춰 키를 눌러 높은 점수를 획득하세요!</CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {keyLabels.map((key, index) => (
                  <div key={index} className="text-center">
                    <div
                      className={`w-16 h-16 mx-auto rounded-lg ${laneColors[index]} flex items-center justify-center text-2xl font-bold mb-2 shadow-lg`}
                    >
                      {key}
                    </div>
                    <p className="text-sm text-gray-400">레인 {index + 1}</p>
                  </div>
                ))}
              </div>

              {/* 배속 선택 UI */}
              <div className="flex items-center justify-center gap-3 mb-6">
                <FastForward className="w-5 h-5 text-gray-400" />
                <span className="text-gray-300">배속:</span>
                <Select
                  value={speedMultiplier.toString()}
                  onValueChange={(value) => setSpeedMultiplier(Number.parseFloat(value))}
                >
                  <SelectTrigger className="w-[120px] bg-gray-800 border-gray-600 text-white">
                    <SelectValue placeholder="1.0x" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-600 text-white">
                    <SelectItem value="0.5">0.5x</SelectItem>
                    <SelectItem value="0.75">0.75x</SelectItem>
                    <SelectItem value="1">1.0x</SelectItem>
                    <SelectItem value="1.25">1.25x</SelectItem>
                    <SelectItem value="1.5">1.5x</SelectItem>
                    <SelectItem value="1.75">1.75x</SelectItem>
                    <SelectItem value="2">2.0x</SelectItem>
                    <SelectItem value="2.5">2.5x</SelectItem>
                    <SelectItem value="3">3.0x</SelectItem>
                    <SelectItem value="3.5">3.5x</SelectItem>
                    <SelectItem value="4">4.0x</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={startGame} size="lg" className="bg-purple-600 hover:bg-purple-700 shadow-lg">
                <Play className="w-5 h-5 mr-2" />
                게임 시작
              </Button>
            </CardContent>
          </Card>
        )}

        {(gameState === "playing" || gameState === "paused") && (
          <>
            {/* 게임 UI - 버튼들이 잘 보이도록 수정 */}
            <div className="flex justify-between items-center bg-gray-900 p-4 rounded-lg shadow-lg border border-gray-700">
              <div className="flex gap-6 text-sm">
                <div className="text-white">
                  점수: <span className="text-yellow-400 font-bold text-lg">{stats.score.toLocaleString()}</span>
                </div>
                <div className="text-white">
                  콤보: <span className="text-green-400 font-bold text-lg">{stats.combo}</span>
                </div>
                <div className="text-white">
                  최대 콤보: <span className="text-blue-400 font-bold text-lg">{stats.maxCombo}</span>
                </div>
                <div className="text-white">
                  배속: <span className="text-purple-400 font-bold text-lg">{speedMultiplier.toFixed(2)}x</span>
                </div>
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={togglePause}
                  variant="outline"
                  size="sm"
                  className="bg-gray-800 border-gray-600 text-white hover:bg-gray-700 hover:text-white"
                >
                  {gameState === "playing" ? (
                    <>
                      <Pause className="w-4 h-4 mr-1" />
                      일시정지
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-1" />
                      계속하기
                    </>
                  )}
                </Button>
                <Button
                  onClick={resetGame}
                  variant="outline"
                  size="sm"
                  className="bg-gray-800 border-gray-600 text-white hover:bg-gray-700 hover:text-white"
                >
                  <RotateCcw className="w-4 h-4 mr-1" />
                  재시작
                </Button>
              </div>
            </div>

            {/* 게임 영역 */}
            <div
              ref={gameAreaRef}
              className="relative bg-gradient-to-b from-gray-900 to-gray-800 rounded-lg overflow-hidden shadow-2xl border border-gray-700"
              style={{ height: `${GAME_HEIGHT}px` }}
            >
              {/* 레인 */}
              <div className="absolute inset-0 flex">
                {Array.from({ length: LANES }).map((_, index) => (
                  <div
                    key={index}
                    className={`flex-1 border-r border-gray-600 relative transition-all duration-150 ${
                      pressedKeys.has(index) ? "bg-white bg-opacity-20 shadow-inner" : ""
                    }`}
                  >
                    {/* 키 라벨 */}
                    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-30">
                      <div
                        className={`w-14 h-14 rounded-xl ${laneColors[index]} flex items-center justify-center text-xl font-bold shadow-lg border-2 border-white ${
                          pressedKeys.has(index) ? "scale-110 shadow-2xl" : ""
                        } transition-all duration-100`}
                      >
                        {keyLabels[index]}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 판정선 */}
              <div
                className="absolute left-0 right-0 h-1 bg-white shadow-lg z-20"
                style={{ top: `${JUDGMENT_LINE_Y}px` }}
              />

              {/* 판정선 글로우 효과 */}
              <div
                className="absolute left-0 right-0 h-2 bg-white opacity-30 blur-sm z-19"
                style={{ top: `${JUDGMENT_LINE_Y - 0.5}px` }}
              />

              {/* 판정 텍스트 */}
              {judgment && (
                <div
                  className={`absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-5xl font-bold z-40 ${judgment.color} animate-bounce drop-shadow-lg`}
                  style={{ textShadow: "2px 2px 4px rgba(0,0,0,0.8)" }}
                >
                  {judgment.text}
                </div>
              )}

              {/* 일시정지 오버레이 */}
              {gameState === "paused" && (
                <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 backdrop-blur-sm">
                  <div className="text-center">
                    <h2 className="text-4xl font-bold mb-4 text-white">일시정지</h2>
                    <Button onClick={togglePause} size="lg" className="bg-purple-600 hover:bg-purple-700">
                      <Play className="w-5 h-5 mr-2" />
                      계속하기
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* 통계 */}
            <div className="grid grid-cols-3 gap-4">
              <Card className="bg-gray-900 border-gray-700 shadow-lg">
                <CardContent className="p-4 text-center">
                  <div className="text-3xl font-bold text-yellow-400">{stats.perfect}</div>
                  <div className="text-sm text-gray-400">PERFECT</div>
                </CardContent>
              </Card>
              <Card className="bg-gray-900 border-gray-700 shadow-lg">
                <CardContent className="p-4 text-center">
                  <div className="text-3xl font-bold text-green-400">{stats.good}</div>
                  <div className="text-sm text-gray-400">GOOD</div>
                </CardContent>
              </Card>
              <Card className="bg-gray-900 border-gray-700 shadow-lg">
                <CardContent className="p-4 text-center">
                  <div className="text-3xl font-bold text-red-400">{stats.miss}</div>
                  <div className="text-sm text-gray-400">MISS</div>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* 게임 설명 */}
        <Card className="bg-gray-900 border-gray-700 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Gamepad2 className="w-5 h-5" />
              게임 방법
            </CardTitle>
          </CardHeader>
          <CardContent className="text-gray-300 space-y-2">
            <p>
              • <strong>A, S, D, F</strong> 키 또는 <strong>화살표 키</strong>를 사용하여 각 레인의 노트를 맞춰보세요
            </p>
            <p>• 노트가 판정선(흰색 선)에 도달할 때 키를 누르면 점수를 획득합니다</p>
            <p>
              • <strong>PERFECT</strong>: 정확한 타이밍 (1000점 + 콤보 보너스)
            </p>
            <p>
              • <strong>GOOD</strong>: 괜찮은 타이밍 (500점 + 콤보 보너스)
            </p>
            <p>
              • <strong>MISS</strong>: 놓친 노트 (콤보 초기화)
            </p>
            <p>• 연속으로 노트를 맞추면 콤보가 쌓여 더 높은 점수를 얻을 수 있습니다!</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
