"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Play, Pause, RotateCcw, Music, Gamepad2 } from "lucide-react"
import { toast } from "sonner"

interface Note {
  id: number
  lane: number
  time: number
  y: number
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
const NOTE_SPEED = 300 // pixels per second
const JUDGMENT_LINE_Y = 500
const PERFECT_THRESHOLD = 50
const GOOD_THRESHOLD = 100

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
  const [currentTime, setCurrentTime] = useState(0)
  const [pressedKeys, setPressedKeys] = useState<Set<number>>(new Set())
  const [judgment, setJudgment] = useState<{ text: string; color: string } | null>(null)

  const gameAreaRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<number>(0)
  const startTimeRef = useRef<number>(0)
  const noteIdRef = useRef(0)

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
      [0, 1, 2],
      [1, 2, 3], // 트리플 노트
    ]

    for (let time = 2000; time < 60000; time += 500 + Math.random() * 1000) {
      const pattern = patterns[Math.floor(Math.random() * patterns.length)]
      pattern.forEach((lane) => {
        newNotes.push({
          id: noteIdRef.current++,
          lane,
          time,
          y: -100,
          hit: false,
        })
      })
    }

    return newNotes.sort((a, b) => a.time - b.time)
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
    [gameState, pressedKeys, currentTime, notes],
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

  // 노트 히트 체크
  const checkNoteHit = useCallback(
    (lane: number) => {
      const hitWindow = notes.find(
        (note) => note.lane === lane && !note.hit && Math.abs(note.y - JUDGMENT_LINE_Y) < GOOD_THRESHOLD,
      )

      if (hitWindow) {
        const distance = Math.abs(hitWindow.y - JUDGMENT_LINE_Y)
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
            score: prev.score + scoreAdd * (prev.combo + 1),
          }))
        } else if (distance < GOOD_THRESHOLD) {
          judgmentText = "GOOD"
          judgmentColor = "text-green-400"
          scoreAdd = 500
          setStats((prev) => ({
            ...prev,
            good: prev.good + 1,
            combo: prev.combo + 1,
            score: prev.score + scoreAdd * (prev.combo + 1),
          }))
        }

        setJudgment({ text: judgmentText, color: judgmentColor })
        setTimeout(() => setJudgment(null), 500)

        setNotes((prev) => prev.map((note) => (note.id === hitWindow.id ? { ...note, hit: true } : note)))
      }
    },
    [notes],
  )

  // 게임 루프
  const gameLoop = useCallback(
    (timestamp: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp
      }

      const elapsed = timestamp - startTimeRef.current
      setCurrentTime(elapsed)

      // 노트 위치 업데이트
      setNotes((prev) =>
        prev.map((note) => ({
          ...note,
          y: -100 + ((elapsed - note.time) / 1000) * NOTE_SPEED,
        })),
      )

      // Miss 판정
      setNotes((prev) => {
        const updatedNotes = prev.map((note) => {
          if (!note.hit && note.y > JUDGMENT_LINE_Y + GOOD_THRESHOLD) {
            setStats((prevStats) => ({
              ...prevStats,
              miss: prevStats.miss + 1,
              combo: 0,
              maxCombo: Math.max(prevStats.maxCombo, prevStats.combo),
            }))
            return { ...note, hit: true }
          }
          return note
        })
        return updatedNotes
      })

      if (gameState === "playing") {
        animationRef.current = requestAnimationFrame(gameLoop)
      }
    },
    [gameState],
  )

  // 게임 시작
  const startGame = () => {
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
    setCurrentTime(0)
    startTimeRef.current = 0;
    setGameState("playing")

    toast("A, S, D, F 키 또는 화살표 키를 사용하세요");
  }

  // 게임 일시정지/재개
  const togglePause = () => {
    if (gameState === "playing") {
      setGameState("paused")
    } else if (gameState === "paused") {
      setGameState("playing")
      startTimeRef.current = 0;
    }
  }

  // 게임 재시작
  const resetGame = () => {
    setGameState("menu")
    setNotes([])
    setCurrentTime(0)
    startTimeRef.current = 0;
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

  // 최대 콤보 업데이트
  useEffect(() => {
    setStats((prev) => ({
      ...prev,
      maxCombo: Math.max(prev.maxCombo, prev.combo),
    }))
  }, [stats.combo])

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
                      className={`w-16 h-16 mx-auto rounded-lg ${laneColors[index]} flex items-center justify-center text-2xl font-bold mb-2`}
                    >
                      {key}
                    </div>
                    <p className="text-sm text-gray-400">레인 {index + 1}</p>
                  </div>
                ))}
              </div>
              <Button onClick={startGame} size="lg" className="bg-purple-600 hover:bg-purple-700">
                <Play className="w-5 h-5 mr-2" />
                게임 시작
              </Button>
            </CardContent>
          </Card>
        )}

        {(gameState === "playing" || gameState === "paused") && (
          <>
            {/* 게임 UI */}
            <div className="flex justify-between items-center bg-gray-900 p-4 rounded-lg">
              <div className="flex gap-6 text-sm">
                <div>
                  점수: <span className="text-yellow-400 font-bold">{stats.score.toLocaleString()}</span>
                </div>
                <div>
                  콤보: <span className="text-green-400 font-bold">{stats.combo}</span>
                </div>
                <div>
                  최대 콤보: <span className="text-blue-400 font-bold">{stats.maxCombo}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={togglePause} variant="outline" size="sm">
                  {gameState === "playing" ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </Button>
                <Button onClick={resetGame} variant="outline" size="sm">
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* 게임 영역 */}
            <div
              ref={gameAreaRef}
              className="relative bg-gray-900 rounded-lg overflow-hidden"
              style={{ height: "600px" }}
            >
              {/* 레인 */}
              <div className="absolute inset-0 flex">
                {Array.from({ length: LANES }).map((_, index) => (
                  <div
                    key={index}
                    className={`flex-1 border-r border-gray-700 relative ${
                      pressedKeys.has(index) ? "bg-white bg-opacity-20" : ""
                    }`}
                  >
                    {/* 키 라벨 */}
                    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
                      <div
                        className={`w-12 h-12 rounded-lg ${laneColors[index]} flex items-center justify-center text-xl font-bold ${
                          pressedKeys.has(index) ? "scale-110" : ""
                        } transition-transform`}
                      >
                        {keyLabels[index]}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 판정선 */}
              <div
                className="absolute left-0 right-0 h-1 bg-white opacity-80 z-20"
                style={{ top: `${JUDGMENT_LINE_Y}px` }}
              />

              {/* 노트 */}
              {notes
                .filter((note) => !note.hit && note.y > -50 && note.y < 650)
                .map((note) => (
                  <div
                    key={note.id}
                    className={`absolute w-20 h-8 ${laneColors[note.lane]} rounded-md border-2 border-white z-10 transition-all`}
                    style={{
                      left: `${(note.lane * 100) / LANES + 2}%`,
                      width: `${100 / LANES - 4}%`,
                      top: `${note.y}px`,
                    }}
                  />
                ))}

              {/* 판정 텍스트 */}
              {judgment && (
                <div
                  className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-4xl font-bold z-30 ${judgment.color} animate-pulse`}
                >
                  {judgment.text}
                </div>
              )}

              {/* 일시정지 오버레이 */}
              {gameState === "paused" && (
                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40">
                  <div className="text-center">
                    <h2 className="text-4xl font-bold mb-4">일시정지</h2>
                    <Button onClick={togglePause} size="lg">
                      <Play className="w-5 h-5 mr-2" />
                      계속하기
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* 통계 */}
            <div className="grid grid-cols-3 gap-4">
              <Card className="bg-gray-900 border-gray-700">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-yellow-400">{stats.perfect}</div>
                  <div className="text-sm text-gray-400">PERFECT</div>
                </CardContent>
              </Card>
              <Card className="bg-gray-900 border-gray-700">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-green-400">{stats.good}</div>
                  <div className="text-sm text-gray-400">GOOD</div>
                </CardContent>
              </Card>
              <Card className="bg-gray-900 border-gray-700">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-red-400">{stats.miss}</div>
                  <div className="text-sm text-gray-400">MISS</div>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* 게임 설명 */}
        <Card className="bg-gray-900 border-gray-700">
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
