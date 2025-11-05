# iOS App Specification - Debate Recording & Feedback Platform
**Version 2.0 - Implementation Ready**
**Target Platform: iPhone (iOS 16+)**
**Updated: October 2025**

---

## Table of Contents
1. [Architecture Overview](#1-architecture-overview)
2. [User Modes & Authentication](#2-user-modes--authentication)
3. [App Structure & Navigation](#3-app-structure--navigation)
4. [Core Features](#4-core-features)
5. [Offline & Network Handling](#5-offline--network-handling)
6. [Data Models](#6-data-models)
7. [Local Storage Strategy](#7-local-storage-strategy)
8. [API Integration](#8-api-integration)
9. [Audio Recording](#9-audio-recording)
10. [Feedback System](#10-feedback-system)
11. [UI/UX Guidelines](#11-uiux-guidelines)
12. [Error Handling](#12-error-handling)
13. [Performance Requirements](#13-performance-requirements)
14. [Implementation Roadmap](#14-implementation-roadmap)
15. [Testing Strategy](#15-testing-strategy)

---

## 1. Architecture Overview

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────┐
│              iOS App (SwiftUI/UIKit)            │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌──────────────┐  ┌──────────────┐           │
│  │  View Layer  │  │ State Mgmt   │           │
│  │  (SwiftUI)   │  │ (ObservableObject)│       │
│  └──────┬───────┘  └──────┬───────┘           │
│         │                  │                    │
│  ┌──────▼──────────────────▼───────┐           │
│  │     Business Logic Layer        │           │
│  │  - DebateManager                │           │
│  │  - AudioManager                 │           │
│  │  - SyncManager                  │           │
│  │  - FeedbackManager              │           │
│  └──────┬──────────────────────────┘           │
│         │                                       │
│  ┌──────▼──────────────────────────┐           │
│  │      Data Layer                 │           │
│  │  - CoreData (Local DB)          │           │
│  │  - FileManager (Audio Files)    │           │
│  │  - UserDefaults (Settings)      │           │
│  └──────┬──────────────────────────┘           │
│         │                                       │
│  ┌──────▼──────────────────────────┐           │
│  │    Network Layer                │           │
│  │  - APIService (URLSession)      │           │
│  │  - UploadQueue (Background)     │           │
│  └──────┬──────────────────────────┘           │
└─────────┼─────────────────────────────────────┘
          │
          ▼
    ┌─────────────┐
    │   Backend   │
    │  REST API   │
    └─────────────┘
```

### 1.2 Tech Stack

**UI Framework**: SwiftUI (primary) with UIKit interop
**Persistence**: Core Data
**Audio**: AVFoundation (AVAudioRecorder, AVAudioPlayer)
**Networking**: URLSession (native) with background upload support
**State Management**: Combine framework
**File Storage**: FileManager (Documents directory)
**Dependencies**: Minimal third-party (prefer native APIs)

### 1.3 Key Design Principles

1. **Offline-First**: Recording and timing work without network
2. **Background Resilience**: Audio recording continues through interruptions
3. **Sync Queue**: Automatic retry with manual fallback
4. **Progressive Enhancement**: Basic features work in guest mode
5. **Data Persistence**: Keep local copies until server confirms processing

---

## 2. User Modes & Authentication

### 2.1 Mode Selection Screen (Launch)

```
┌───────────────────────────────────┐
│                                   │
│     [Capstone Debate Logo]        │
│                                   │
│    Recording & Feedback Tool      │
│                                   │
├───────────────────────────────────┤
│                                   │
│  ┌─────────────────────────────┐  │
│  │   Sign In as Teacher        │  │
│  │   (Device Authentication)   │  │
│  └─────────────────────────────┘  │
│                                   │
│  ┌─────────────────────────────┐  │
│  │   Continue as Guest         │  │
│  │   (No login required)       │  │
│  └─────────────────────────────┘  │
│                                   │
└───────────────────────────────────┘
```

### 2.2 Authenticated Mode

**Authentication Flow**:
1. User taps "Sign In as Teacher"
2. Show email input field
3. App reads device ID from iOS (UIDevice.current.identifierForVendor)
4. POST to `/api/auth/login` with email + device_id
5. Store JWT token in Keychain
6. Store user info in UserDefaults
7. Navigate to main screen

**Features Unlocked**:
- Auto-population from schedule API
- Feedback history (all debates ever)
- Cloud sync of debates
- Teacher-specific settings
- Admin dashboard access (if admin role)

**Data Model**:
```swift
struct AuthenticatedUser: Codable {
    let id: String
    let email: String
    let name: String
    let role: UserRole
    let institution: String
    let deviceId: String
}

enum UserRole: String, Codable {
    case teacher
    case admin
}
```

### 2.3 Guest Mode

**Flow**:
1. User taps "Continue as Guest"
2. Generate temporary session ID (UUID)
3. Store in UserDefaults with timestamp
4. Navigate to main screen (no API call)

**Features Available**:
- Manual debate setup (no auto-population)
- Full recording and timing functionality
- Feedback generation for current + recent debates
- Download/export feedback as PDF or share link
- Archive access for last 1-2 entire debates (all speeches)

**Limitations**:
- No schedule integration
- No cloud backup
- No history beyond 2 debates
- No cross-device sync

**Archive Behavior** (Guest Mode):
```swift
// Keep last 2 entire debates with all speeches
// When 3rd debate starts, delete 1st debate completely
struct GuestArchivePolicy {
    static let maxDebates = 2

    func shouldDeleteOldest(currentDebateCount: Int) -> Bool {
        return currentDebateCount > maxDebates
    }

    func cleanup() {
        // Delete oldest debate (all speeches + feedback + audio files)
        let debates = fetchAllDebates().sorted { $0.createdAt < $1.createdAt }
        if debates.count > maxDebates {
            deleteDebate(debates[0])
        }
    }
}
```

---

## 3. App Structure & Navigation

### 3.1 Tab Bar Navigation (Authenticated Mode)

```
┌─────────────────────────────────────┐
│         Main Content Area           │
│                                     │
│                                     │
└─────────────────────────────────────┘
┌───────┬────────┬─────────┬─────────┐
│ New   │ Active │ History │ Settings│
│ 🎤    │  ⏱️    │  📋     │  ⚙️     │
└───────┴────────┴─────────┴─────────┘
```

**Tabs**:
1. **New Debate**: Setup new debate session
2. **Active**: Current ongoing debate (timer/recording)
3. **History**: Past debates and feedback
4. **Settings**: User preferences, sync status, logout

### 3.2 Simplified Navigation (Guest Mode)

```
┌─────────────────────────────────────┐
│         Main Content Area           │
│                                     │
│                                     │
└─────────────────────────────────────┘
┌───────┬────────┬─────────────────────┐
│ New   │ Active │ Recent (Last 2)     │
│ 🎤    │  ⏱️    │  📋                 │
└───────┴────────┴─────────────────────┘
```

### 3.3 Navigation State Machine

```swift
enum AppScreen {
    case modeSelection
    case authentication
    case debateSetup
    case teamAssignment
    case activeDebate
    case feedbackView
    case history
    case settings
}

class NavigationCoordinator: ObservableObject {
    @Published var currentScreen: AppScreen = .modeSelection
    @Published var isAuthenticated: Bool = false
    @Published var activeDebate: DebateSession?
}
```

---

## 4. Core Features

### 4.1 Debate Setup Flow

#### Step 1: Motion & Format Input

```
┌─────────────────────────────────────┐
│  New Debate                    [X]  │
├─────────────────────────────────────┤
│                                     │
│  Debate Motion:                     │
│  ┌───────────────────────────────┐  │
│  │ This house would ban...       │  │
│  └───────────────────────────────┘  │
│                                     │
│  [📋 Suggestions] (if authenticated)│
│                                     │
│  Format:                            │
│  ○ Modified WSDC (3v3)              │
│  ○ British Parliamentary (4x2)      │
│  ○ Asian Parliamentary (2v2)        │
│  ○ Australs (3v3)                   │
│                                     │
│  Student Level:                     │
│  ○ Primary    ○ Secondary           │
│                                     │
│  Speech Time: [5] minutes           │
│  Reply Time:  [2] minutes (if WSDC) │
│                                     │
│  ┌─────────────────────────────────┐│
│  │    Next: Add Students           ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

**Implementation**:
```swift
struct DebateSetupView: View {
    @State private var motion: String = ""
    @State private var format: DebateFormat = .wsdc
    @State private var studentLevel: StudentLevel = .secondary
    @State private var speechTime: Int = 5 // minutes
    @State private var replyTime: Int = 2

    var body: some View {
        Form {
            Section("Motion") {
                TextEditor(text: $motion)
                    .frame(height: 100)

                if isAuthenticated {
                    Button("Load Suggestions") {
                        loadScheduleSuggestions()
                    }
                }
            }

            Section("Format") {
                Picker("Format", selection: $format) {
                    ForEach(DebateFormat.allCases) { format in
                        Text(format.displayName).tag(format)
                    }
                }
                .pickerStyle(.inline)
            }

            Section("Settings") {
                Picker("Level", selection: $studentLevel) {
                    Text("Primary").tag(StudentLevel.primary)
                    Text("Secondary").tag(StudentLevel.secondary)
                }
                .pickerStyle(.segmented)

                Stepper("Speech Time: \(speechTime) min",
                        value: $speechTime, in: 3...10)

                if format.hasReply {
                    Stepper("Reply Time: \(replyTime) min",
                            value: $replyTime, in: 1...5)
                }
            }
        }
        .navigationTitle("New Debate")
        .toolbar {
            Button("Next") { proceedToTeamSetup() }
        }
    }
}
```

#### Step 2: Student List Management

**Authenticated Mode**:
```
┌─────────────────────────────────────┐
│  Students                      [X]  │
├─────────────────────────────────────┤
│  Auto-loaded from schedule:         │
│                                     │
│  ✓ Alice Johnson    [Primary]      │
│  ✓ Bob Smith        [Secondary]    │
│  ✓ Charlie Davis    [Secondary]    │
│  ✓ Diana Lee        [Primary]      │
│  ✓ Ethan Brown      [Secondary]    │
│  ✓ Fiona Taylor     [Secondary]    │
│                                     │
│  [+ Add Student]                    │
│                                     │
│  ┌─────────────────────────────────┐│
│  │    Next: Assign Teams           ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

**Guest Mode**:
```
┌─────────────────────────────────────┐
│  Students                      [X]  │
├─────────────────────────────────────┤
│  Add students manually:             │
│                                     │
│  1. [Alice            ] [Remove]    │
│  2. [Bob              ] [Remove]    │
│  3. [Charlie          ] [Remove]    │
│  4. [Diana            ] [Remove]    │
│  5. [Ethan            ] [Remove]    │
│  6. [Fiona            ] [Remove]    │
│                                     │
│  [+ Add Another Student]            │
│                                     │
│  ┌─────────────────────────────────┐│
│  │    Next: Assign Teams           ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

**Implementation**:
```swift
class StudentListViewModel: ObservableObject {
    @Published var students: [Student] = []

    func loadFromSchedule(teacherId: String) async {
        guard let scheduleData = try? await APIService.shared
            .getCurrentSchedule(teacherId: teacherId) else { return }

        students = scheduleData.students
    }

    func addManualStudent(name: String, level: StudentLevel) {
        let student = Student(
            id: UUID().uuidString,
            name: name,
            level: level
        )
        students.append(student)
    }

    func removeStudent(at index: Int) {
        students.remove(at: index)
    }
}
```

#### Step 3: Team Assignment (Drag & Drop)

**For 3v3 Format**:
```
┌─────────────────────────────────────┐
│  Team Assignment               [X]  │
├─────────────────────────────────────┤
│                                     │
│  Unassigned:                        │
│  ┌───────────────────────────────┐  │
│  │ [Alice] [Bob] [Charlie]       │  │
│  │ [Diana] [Ethan] [Fiona]       │  │
│  └───────────────────────────────┘  │
│                                     │
│  ┌──────────────┬──────────────┐    │
│  │ Proposition  │ Opposition   │    │
│  ├──────────────┼──────────────┤    │
│  │ Speaker 1:   │ Speaker 1:   │    │
│  │ [Drop here]  │ [Drop here]  │    │
│  │              │              │    │
│  │ Speaker 2:   │ Speaker 2:   │    │
│  │ [Drop here]  │ [Drop here]  │    │
│  │              │              │    │
│  │ Speaker 3:   │ Speaker 3:   │    │
│  │ [Drop here]  │ [Drop here]  │    │
│  └──────────────┴──────────────┘    │
│                                     │
│  ┌─────────────────────────────────┐│
│  │    Start Debate                 ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

**Implementation**:
```swift
struct TeamAssignmentView: View {
    @State private var unassignedStudents: [Student] = []
    @State private var propTeam: [Student?] = [nil, nil, nil]
    @State private var oppTeam: [Student?] = [nil, nil, nil]

    var body: some View {
        VStack {
            // Unassigned pool
            ScrollView(.horizontal) {
                HStack {
                    ForEach(unassignedStudents) { student in
                        StudentChip(student: student)
                            .onDrag { NSItemProvider(object: student.id as NSString) }
                    }
                }
            }

            HStack {
                // Proposition column
                TeamColumn(title: "Proposition",
                          team: $propTeam,
                          color: .blue)

                // Opposition column
                TeamColumn(title: "Opposition",
                          team: $oppTeam,
                          color: .red)
            }

            Button("Start Debate") {
                createDebateSession()
            }
            .disabled(!teamsComplete)
        }
    }

    var teamsComplete: Bool {
        propTeam.allSatisfy { $0 != nil } &&
        oppTeam.allSatisfy { $0 != nil }
    }
}
```

### 4.2 Timer & Recording Interface

```
┌─────────────────────────────────────┐
│  Debate: [Motion text...]      [≡]  │
├─────────────────────────────────────┤
│                                     │
│  Current Speaker:                   │
│  Alice Johnson                      │
│  Proposition - Speaker 1            │
│                                     │
│         ┌─────────────┐             │
│         │             │             │
│         │   04:23     │             │
│         │             │             │
│         └─────────────┘             │
│                                     │
│      🔴 RECORDING                   │
│      📶 Connected                   │
│                                     │
│  ┌─────────────────────────────────┐│
│  │         STOP                    ││
│  └─────────────────────────────────┘│
│                                     │
│  [⬅ Previous]      [Next ➡]        │
│                                     │
│  Progress: 1/6 speeches             │
│                                     │
│  [View Feedback] [Sync Status]     │
└─────────────────────────────────────┘
```

**Timer Logic**:
```swift
class TimerManager: ObservableObject {
    @Published var elapsedTime: TimeInterval = 0
    @Published var isRunning: Bool = false

    private var timer: Timer?
    private let speechDuration: TimeInterval

    init(speechDuration: Int) {
        self.speechDuration = TimeInterval(speechDuration * 60)
    }

    func start() {
        isRunning = true
        timer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
            self?.tick()
        }
    }

    func stop() {
        isRunning = false
        timer?.invalidate()
        timer = nil
    }

    private func tick() {
        elapsedTime += 0.1

        // Bell logic
        if elapsedTime.isApproximately(60) {
            playBell(count: 1) // 1 minute mark
        } else if elapsedTime.isApproximately(speechDuration - 60) {
            playBell(count: 1) // 1 minute before end
        } else if elapsedTime.isApproximately(speechDuration) {
            playBell(count: 2) // Time's up
        } else if elapsedTime > speechDuration &&
                  Int(elapsedTime - speechDuration) % 15 == 0 {
            playBell(count: 3) // Every 15 seconds after
        }
    }

    private func playBell(count: Int) {
        AudioManager.shared.playBell(count: count)
        HapticManager.shared.notify()
    }
}

extension TimeInterval {
    func isApproximately(_ target: TimeInterval, tolerance: TimeInterval = 0.1) -> Bool {
        return abs(self - target) < tolerance
    }
}
```

**Recording Logic**:
```swift
class AudioManager: ObservableObject {
    private var audioRecorder: AVAudioRecorder?
    private var audioSession: AVAudioSession = .sharedInstance()

    @Published var isRecording: Bool = false
    @Published var recordingURL: URL?

    func startRecording(for debate: DebateSession, speaker: Speaker) throws {
        // Setup audio session
        try audioSession.setCategory(.playAndRecord, mode: .default)
        try audioSession.setActive(true)

        // Generate file URL
        let filename = generateFilename(debate: debate, speaker: speaker)
        let documentsPath = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        recordingURL = documentsPath.appendingPathComponent(filename)

        // Configure recorder settings
        let settings: [String: Any] = [
            AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
            AVSampleRateKey: 44100.0,
            AVNumberOfChannelsKey: 1,
            AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue,
            AVEncoderBitRateKey: 128000
        ]

        // Start recording
        audioRecorder = try AVAudioRecorder(url: recordingURL!, settings: settings)
        audioRecorder?.record()
        isRecording = true
    }

    func stopRecording() -> URL? {
        audioRecorder?.stop()
        isRecording = false

        try? audioSession.setActive(false)

        return recordingURL
    }

    private func generateFilename(debate: DebateSession, speaker: Speaker) -> String {
        let timestamp = ISO8601DateFormatter().string(from: Date())
        let sanitizedName = speaker.name.replacingOccurrences(of: " ", with: "_")
        return "\(debate.id)_\(sanitizedName)_\(speaker.position)_\(timestamp).m4a"
    }

    func playBell(count: Int) {
        let filename = "bell_\(count).mp3"
        guard let url = Bundle.main.url(forResource: filename, withExtension: nil) else { return }

        var bellPlayer: AVAudioPlayer?
        bellPlayer = try? AVAudioPlayer(contentsOf: url)
        bellPlayer?.play()
    }
}
```

**Swipe Gestures**:
```swift
struct ActiveDebateView: View {
    @GestureState private var dragOffset: CGFloat = 0

    var body: some View {
        // ... timer content ...
        .gesture(
            DragGesture()
                .updating($dragOffset) { value, state, _ in
                    state = value.translation.width
                }
                .onEnded { value in
                    if value.translation.width > 100 {
                        // Swipe right - next speaker
                        nextSpeaker()
                    } else if value.translation.width < -100 {
                        // Swipe left - previous speaker (with confirmation)
                        showPreviousSpeakerConfirmation()
                    }
                }
        )
    }
}
```

---

## 5. Offline & Network Handling

### 5.1 Core Principle: Recording Always Works

**Network Requirements**:
- ✅ Recording: NO network needed
- ✅ Timer: NO network needed
- ✅ Local save: NO network needed
- ❌ Upload: REQUIRES network
- ❌ Transcription: REQUIRES network (backend)
- ❌ Feedback generation: REQUIRES network (backend)

### 5.2 Upload Queue System

```swift
class UploadQueueManager: ObservableObject {
    @Published var pendingUploads: [PendingUpload] = []
    @Published var failedUploads: [PendingUpload] = []

    private var uploadTasks: [UUID: URLSessionUploadTask] = [:]

    func enqueue(speech: SpeechRecording) {
        let upload = PendingUpload(
            id: UUID(),
            speechId: speech.id,
            debateId: speech.debateId,
            audioFileURL: speech.localFileURL,
            metadata: speech.metadata,
            retryCount: 0
        )

        pendingUploads.append(upload)
        startUpload(upload)
    }

    func startUpload(_ upload: PendingUpload) {
        let request = createMultipartRequest(for: upload)

        let config = URLSessionConfiguration.background(withIdentifier: "com.capstone.uploads")
        let session = URLSession(configuration: config, delegate: self, delegateQueue: nil)

        let task = session.uploadTask(with: request, fromFile: upload.audioFileURL)
        uploadTasks[upload.id] = task
        task.resume()
    }

    func handleUploadFailure(_ upload: PendingUpload, error: Error) {
        if upload.retryCount < 3 {
            // Auto-retry with exponential backoff
            let delay = pow(2.0, Double(upload.retryCount)) // 1s, 2s, 4s
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
                var retryUpload = upload
                retryUpload.retryCount += 1
                self.startUpload(retryUpload)
            }
        } else {
            // Move to failed uploads for manual retry
            failedUploads.append(upload)
            pendingUploads.removeAll { $0.id == upload.id }
        }
    }

    func manualRetry(upload: PendingUpload) {
        var resetUpload = upload
        resetUpload.retryCount = 0

        if let index = failedUploads.firstIndex(where: { $0.id == upload.id }) {
            failedUploads.remove(at: index)
            pendingUploads.append(resetUpload)
            startUpload(resetUpload)
        }
    }
}

struct PendingUpload: Identifiable {
    let id: UUID
    let speechId: String
    let debateId: String
    let audioFileURL: URL
    let metadata: SpeechMetadata
    var retryCount: Int
    var uploadProgress: Double = 0.0
}
```

### 5.3 Sync Status UI (Not Primary, Accessible)

```
┌─────────────────────────────────────┐
│  Sync Status                   [X]  │
├─────────────────────────────────────┤
│                                     │
│  📤 Uploading:                      │
│  • Alice - Prop 1    [████░░] 75%  │
│                                     │
│  ⏳ Pending:                        │
│  • Bob - Prop 2                    │
│  • Charlie - Prop 3                │
│                                     │
│  ❌ Failed (Tap to retry):         │
│  • Diana - Opp 1     [Retry]       │
│                                     │
│  ✅ Completed:                      │
│  • Ethan - Opp 2                   │
│  • Fiona - Opp 3                   │
│                                     │
│  [Retry All Failed]                │
└─────────────────────────────────────┘
```

Access: Settings tab → "Sync Status" or small sync icon in debate view

### 5.4 Network Monitoring

```swift
import Network

class NetworkMonitor: ObservableObject {
    @Published var isConnected: Bool = true
    @Published var connectionType: NWInterface.InterfaceType?

    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "NetworkMonitor")

    init() {
        monitor.pathUpdateHandler = { [weak self] path in
            DispatchQueue.main.async {
                self?.isConnected = path.status == .satisfied
                self?.connectionType = path.availableInterfaces.first?.type
            }
        }
        monitor.start(queue: queue)
    }

    deinit {
        monitor.cancel()
    }
}
```

---

## 6. Data Models

### 6.1 Core Data Schema

```swift
// MARK: - DebateSession Entity
@objc(DebateSession)
class DebateSession: NSManagedObject {
    @NSManaged var id: String
    @NSManaged var motion: String
    @NSManaged var format: String
    @NSManaged var studentLevel: String
    @NSManaged var speechTimeSeconds: Int16
    @NSManaged var replyTimeSeconds: Int16
    @NSManaged var createdAt: Date
    @NSManaged var completedAt: Date?
    @NSManaged var teacherId: String?
    @NSManaged var isGuestMode: Bool

    @NSManaged var speeches: NSSet?
    @NSManaged var participants: NSSet?
}

// MARK: - SpeechRecording Entity
@objc(SpeechRecording)
class SpeechRecording: NSManagedObject {
    @NSManaged var id: String
    @NSManaged var debateId: String
    @NSManaged var speakerName: String
    @NSManaged var speakerPosition: String
    @NSManaged var localFilePath: String
    @NSManaged var durationSeconds: Int16
    @NSManaged var recordedAt: Date

    // Upload status
    @NSManaged var uploadStatus: String // pending, uploading, uploaded, failed
    @NSManaged var uploadProgress: Double
    @NSManaged var uploadedAt: Date?

    // Processing status
    @NSManaged var processingStatus: String // pending, processing, complete, failed
    @NSManaged var feedbackURL: String?
    @NSManaged var feedbackLocalPath: String? // For downloaded PDFs

    @NSManaged var debate: DebateSession
}

// MARK: - Student Entity
@objc(Student)
class Student: NSManagedObject {
    @NSManaged var id: String
    @NSManaged var name: String
    @NSManaged var level: String
    @NSManaged var isFromSchedule: Bool
}

// MARK: - FeedbackDocument Entity
@objc(FeedbackDocument)
class FeedbackDocument: NSManagedObject {
    @NSManaged var id: String
    @NSManaged var speechId: String
    @NSManaged var googleDocsURL: String
    @NSManaged var localPDFPath: String?
    @NSManaged var downloadedAt: Date?
    @NSManaged var scores: Data? // JSON encoded
}
```

### 6.2 Swift Structs (for API communication)

```swift
// MARK: - API Request/Response Models

struct CreateDebateRequest: Codable {
    let teacherId: String?
    let motion: String
    let format: String
    let studentLevel: String
    let teams: Teams
    let speechTimeSeconds: Int
    let replyTimeSeconds: Int?

    struct Teams: Codable {
        let prop: [Participant]
        let opp: [Participant]
    }

    struct Participant: Codable {
        let studentId: String?
        let name: String
        let position: String
    }
}

struct CreateDebateResponse: Codable {
    let debateId: String
    let createdAt: String
}

struct UploadSpeechResponse: Codable {
    let speechId: String
    let status: String
    let processingStarted: Bool
}

struct FeedbackStatusResponse: Codable {
    let speechId: String
    let transcriptionStatus: String
    let feedbackStatus: String
    let googleDocUrl: String?
    let updatedAt: String
}

struct FeedbackDetailResponse: Codable {
    let speechId: String
    let googleDocUrl: String
    let scores: [String: ScoreValue]
    let qualitativeFeedback: [String: [String]]
    let createdAt: String

    enum ScoreValue: Codable {
        case score(Int)
        case notApplicable

        init(from decoder: Decoder) throws {
            let container = try decoder.singleValueContainer()
            if let int = try? container.decode(Int.self) {
                self = .score(int)
            } else if let str = try? container.decode(String.self), str == "NA" {
                self = .notApplicable
            } else {
                throw DecodingError.dataCorruptedError(
                    in: container,
                    debugDescription: "Invalid score value"
                )
            }
        }
    }
}
```

### 6.3 Enums

```swift
enum DebateFormat: String, Codable, CaseIterable, Identifiable {
    case wsdc = "WSDC"
    case bp = "BP"
    case ap = "AP"
    case australs = "Australs"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .wsdc: return "Modified WSDC (3v3)"
        case .bp: return "British Parliamentary (4x2)"
        case .ap: return "Asian Parliamentary (2v2)"
        case .australs: return "Australs (3v3)"
        }
    }

    var hasReply: Bool {
        self == .wsdc || self == .australs
    }

    var teamCount: Int {
        switch self {
        case .wsdc, .australs, .ap: return 2
        case .bp: return 4
        }
    }
}

enum StudentLevel: String, Codable {
    case primary
    case secondary
}

enum UploadStatus: String {
    case pending
    case uploading
    case uploaded
    case failed
}

enum ProcessingStatus: String {
    case pending
    case processing
    case complete
    case failed
}
```

---

## 7. Local Storage Strategy

### 7.1 File Organization

```
Documents/
├── Debates/
│   ├── {debate_id}/
│   │   ├── audio/
│   │   │   ├── {speech_id}.m4a
│   │   │   ├── {speech_id}.m4a
│   │   │   └── ...
│   │   └── feedback/
│   │       ├── {speech_id}.pdf (downloaded)
│   │       ├── {speech_id}.pdf
│   │       └── ...
```

### 7.2 Storage Manager

```swift
class StorageManager {
    static let shared = StorageManager()

    private let fileManager = FileManager.default
    private lazy var documentsURL: URL = {
        fileManager.urls(for: .documentDirectory, in: .userDomainMask)[0]
    }()

    // MARK: - Audio Files

    func saveAudioFile(data: Data, for speech: SpeechRecording) throws -> URL {
        let debateFolder = documentsURL
            .appendingPathComponent("Debates")
            .appendingPathComponent(speech.debateId)
            .appendingPathComponent("audio")

        try fileManager.createDirectory(at: debateFolder,
                                       withIntermediateDirectories: true)

        let fileURL = debateFolder.appendingPathComponent("\(speech.id).m4a")
        try data.write(to: fileURL)

        return fileURL
    }

    func deleteAudioFile(at path: String) throws {
        let url = URL(fileURLWithPath: path)
        try fileManager.removeItem(at: url)
    }

    // MARK: - Feedback PDFs

    func saveFeedbackPDF(data: Data, for speechId: String, debateId: String) throws -> URL {
        let feedbackFolder = documentsURL
            .appendingPathComponent("Debates")
            .appendingPathComponent(debateId)
            .appendingPathComponent("feedback")

        try fileManager.createDirectory(at: feedbackFolder,
                                       withIntermediateDirectories: true)

        let fileURL = feedbackFolder.appendingPathComponent("\(speechId).pdf")
        try data.write(to: fileURL)

        return fileURL
    }

    // MARK: - Cleanup

    func deleteDebate(debateId: String) throws {
        let debateFolder = documentsURL
            .appendingPathComponent("Debates")
            .appendingPathComponent(debateId)

        try fileManager.removeItem(at: debateFolder)
    }

    func getStorageSize() -> Int64 {
        let debatesFolder = documentsURL.appendingPathComponent("Debates")

        guard let enumerator = fileManager.enumerator(at: debatesFolder,
                                                      includingPropertiesForKeys: [.fileSizeKey]) else {
            return 0
        }

        var totalSize: Int64 = 0
        for case let fileURL as URL in enumerator {
            if let fileSize = try? fileURL.resourceValues(forKeys: [.fileSizeKey]).fileSize {
                totalSize += Int64(fileSize)
            }
        }

        return totalSize
    }
}
```

### 7.3 Guest Mode Cleanup Policy

```swift
class GuestModeManager {
    static let shared = GuestModeManager()
    private let maxDebatesInGuestMode = 2

    func checkAndCleanup(context: NSManagedObjectContext) {
        let fetchRequest: NSFetchRequest<DebateSession> = DebateSession.fetchRequest()
        fetchRequest.predicate = NSPredicate(format: "isGuestMode == true")
        fetchRequest.sortDescriptors = [NSSortDescriptor(key: "createdAt", ascending: true)]

        guard let debates = try? context.fetch(fetchRequest) else { return }

        if debates.count > maxDebatesInGuestMode {
            // Delete oldest debates
            let debatesToDelete = debates.prefix(debates.count - maxDebatesInGuestMode)

            for debate in debatesToDelete {
                // Delete all audio files
                if let speeches = debate.speeches?.allObjects as? [SpeechRecording] {
                    for speech in speeches {
                        try? StorageManager.shared.deleteAudioFile(at: speech.localFilePath)
                    }
                }

                // Delete debate folder
                try? StorageManager.shared.deleteDebate(debateId: debate.id)

                // Delete from Core Data
                context.delete(debate)
            }

            try? context.save()
        }
    }
}
```

---

## 8. API Integration

### 8.1 API Service

```swift
class APIService {
    static let shared = APIService()

    private let baseURL: String = "https://your-vps-domain.com/api"
    private var authToken: String? {
        get { KeychainManager.shared.getToken() }
        set { KeychainManager.shared.saveToken(newValue) }
    }

    // MARK: - Authentication

    func login(email: String, deviceId: String) async throws -> AuthenticatedUser {
        let request = LoginRequest(email: email, deviceId: deviceId)
        let response: LoginResponse = try await post("/auth/login", body: request)

        authToken = response.token
        return response.user
    }

    // MARK: - Debate Management

    func createDebate(_ request: CreateDebateRequest) async throws -> CreateDebateResponse {
        return try await post("/debates/create", body: request)
    }

    func getDebate(id: String) async throws -> DebateDetailResponse {
        return try await get("/debates/\(id)")
    }

    // MARK: - Speech Upload

    func uploadSpeech(
        debateId: String,
        audioFileURL: URL,
        metadata: SpeechMetadata,
        progressHandler: @escaping (Double) -> Void
    ) async throws -> UploadSpeechResponse {

        let boundary = UUID().uuidString
        var request = URLRequest(url: URL(string: "\(baseURL)/debates/\(debateId)/speeches")!)
        request.httpMethod = "POST"
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        // Build multipart body
        let httpBody = createMultipartBody(
            boundary: boundary,
            audioFileURL: audioFileURL,
            metadata: metadata
        )

        // Use background upload session
        let config = URLSessionConfiguration.background(withIdentifier: "com.capstone.upload.\(UUID())")
        let session = URLSession(configuration: config, delegate: nil, delegateQueue: nil)

        // Write body to temp file
        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try httpBody.write(to: tempURL)

        let uploadTask = session.uploadTask(with: request, fromFile: tempURL)

        // Monitor progress
        let observation = uploadTask.progress.observe(\.fractionCompleted) { progress, _ in
            progressHandler(progress.fractionCompleted)
        }

        uploadTask.resume()

        // Wait for completion (simplified - use delegates in production)
        // Return parsed response
        return UploadSpeechResponse(speechId: "temp", status: "uploaded", processingStarted: true)
    }

    // MARK: - Feedback Polling

    func getFeedbackStatus(speechId: String) async throws -> FeedbackStatusResponse {
        return try await get("/speeches/\(speechId)/status")
    }

    func getFeedbackDetail(speechId: String) async throws -> FeedbackDetailResponse {
        return try await get("/speeches/\(speechId)/feedback")
    }

    // MARK: - Helper Methods

    private func get<T: Decodable>(_ endpoint: String) async throws -> T {
        var request = URLRequest(url: URL(string: baseURL + endpoint)!)
        request.httpMethod = "GET"

        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw APIError.invalidResponse
        }

        return try JSONDecoder().decode(T.self, from: data)
    }

    private func post<T: Encodable, R: Decodable>(_ endpoint: String, body: T) async throws -> R {
        var request = URLRequest(url: URL(string: baseURL + endpoint)!)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        request.httpBody = try JSONEncoder().encode(body)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw APIError.invalidResponse
        }

        return try JSONDecoder().decode(R.self, from: data)
    }

    private func createMultipartBody(boundary: String, audioFileURL: URL, metadata: SpeechMetadata) -> Data {
        var body = Data()

        // Add audio file
        body.append("--\(boundary)\r\n")
        body.append("Content-Disposition: form-data; name=\"audio_file\"; filename=\"\(audioFileURL.lastPathComponent)\"\r\n")
        body.append("Content-Type: audio/m4a\r\n\r\n")
        if let fileData = try? Data(contentsOf: audioFileURL) {
            body.append(fileData)
        }
        body.append("\r\n")

        // Add metadata fields
        let fields = [
            "speaker_name": metadata.speakerName,
            "speaker_position": metadata.speakerPosition,
            "duration_seconds": "\(metadata.durationSeconds)",
            "student_level": metadata.studentLevel
        ]

        for (key, value) in fields {
            body.append("--\(boundary)\r\n")
            body.append("Content-Disposition: form-data; name=\"\(key)\"\r\n\r\n")
            body.append("\(value)\r\n")
        }

        body.append("--\(boundary)--\r\n")
        return body
    }
}

extension Data {
    mutating func append(_ string: String) {
        if let data = string.data(using: .utf8) {
            append(data)
        }
    }
}

enum APIError: Error {
    case invalidResponse
    case networkError
    case decodingError
}

struct SpeechMetadata {
    let speakerName: String
    let speakerPosition: String
    let durationSeconds: Int
    let studentLevel: String
}
```

---

## 10. Feedback System

### 10.1 Feedback Polling Manager

```swift
class FeedbackPollingManager: ObservableObject {
    @Published var pollingSpeeches: Set<String> = []

    private var pollingTasks: [String: Task<Void, Never>] = [:]
    private let pollingInterval: TimeInterval = 10 // seconds

    func startPolling(for speechId: String) {
        guard !pollingSpeeches.contains(speechId) else { return }

        pollingSpeeches.insert(speechId)

        let task = Task {
            while !Task.isCancelled {
                do {
                    let status = try await APIService.shared.getFeedbackStatus(speechId: speechId)

                    if status.feedbackStatus == "complete" {
                        // Feedback ready!
                        await updateSpeechWithFeedback(speechId: speechId, url: status.googleDocUrl)
                        stopPolling(for: speechId)
                        break
                    } else if status.feedbackStatus == "failed" {
                        // Processing failed
                        await markSpeechAsFailed(speechId: speechId)
                        stopPolling(for: speechId)
                        break
                    }

                    try await Task.sleep(nanoseconds: UInt64(pollingInterval * 1_000_000_000))
                } catch {
                    print("Polling error: \(error)")
                    try? await Task.sleep(nanoseconds: UInt64(pollingInterval * 1_000_000_000))
                }
            }
        }

        pollingTasks[speechId] = task
    }

    func stopPolling(for speechId: String) {
        pollingTasks[speechId]?.cancel()
        pollingTasks.removeValue(forKey: speechId)
        pollingSpeeches.remove(speechId)
    }

    @MainActor
    private func updateSpeechWithFeedback(speechId: String, url: String?) {
        let context = PersistenceController.shared.container.viewContext
        let fetchRequest: NSFetchRequest<SpeechRecording> = SpeechRecording.fetchRequest()
        fetchRequest.predicate = NSPredicate(format: "id == %@", speechId)

        if let speech = try? context.fetch(fetchRequest).first {
            speech.processingStatus = ProcessingStatus.complete.rawValue
            speech.feedbackURL = url
            try? context.save()
        }
    }

    @MainActor
    private func markSpeechAsFailed(speechId: String) {
        let context = PersistenceController.shared.container.viewContext
        let fetchRequest: NSFetchRequest<SpeechRecording> = SpeechRecording.fetchRequest()
        fetchRequest.predicate = NSPredicate(format: "id == %@", speechId)

        if let speech = try? context.fetch(fetchRequest).first {
            speech.processingStatus = ProcessingStatus.failed.rawValue
            try? context.save()
        }
    }
}
```

### 10.2 Feedback View

```
┌─────────────────────────────────────┐
│  Feedback - Alice Johnson      [X]  │
├─────────────────────────────────────┤
│                                     │
│  Speaker: Alice Johnson             │
│  Position: Proposition - Speaker 1  │
│  Motion: This house would ban...    │
│  Duration: 5:23                     │
│                                     │
│  Status: ✅ Ready                   │
│                                     │
│  ┌─────────────────────────────────┐│
│  │  📄 View in Google Docs         ││
│  └─────────────────────────────────┘│
│                                     │
│  ┌─────────────────────────────────┐│
│  │  📥 Download as PDF             ││
│  └─────────────────────────────────┘│
│                                     │
│  ┌─────────────────────────────────┐│
│  │  🔗 Share Link                  ││
│  └─────────────────────────────────┘│
│                                     │
│  Quick Preview:                     │
│  ┌───────────────────────────────┐  │
│  │ Argumentation:      4/5       │  │
│  │ Delivery:           3/5       │  │
│  │ Structure:          5/5       │  │
│  │ Engagement:         4/5       │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

### 10.3 PDF Download Implementation

```swift
class FeedbackDownloadManager {
    static let shared = FeedbackDownloadManager()

    func downloadFeedbackAsPDF(googleDocsURL: String, speechId: String, debateId: String) async throws -> URL {
        // Convert Google Docs URL to export URL
        let docId = extractDocId(from: googleDocsURL)
        let exportURL = "https://docs.google.com/document/d/\(docId)/export?format=pdf"

        // Download PDF
        let (data, response) = try await URLSession.shared.data(from: URL(string: exportURL)!)

        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw FeedbackError.downloadFailed
        }

        // Save to local storage
        let localURL = try StorageManager.shared.saveFeedbackPDF(
            data: data,
            for: speechId,
            debateId: debateId
        )

        return localURL
    }

    func shareFeedback(googleDocsURL: String) {
        let activityVC = UIActivityViewController(
            activityItems: [URL(string: googleDocsURL)!],
            applicationActivities: nil
        )

        // Present from top view controller
        if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
           let rootVC = windowScene.windows.first?.rootViewController {
            rootVC.present(activityVC, animated: true)
        }
    }

    private func extractDocId(from url: String) -> String {
        // Parse Google Docs URL to get document ID
        // Example: https://docs.google.com/document/d/ABC123/edit
        let components = url.components(separatedBy: "/")
        if let dIndex = components.firstIndex(of: "d"),
           dIndex + 1 < components.count {
            return components[dIndex + 1]
        }
        return ""
    }
}

enum FeedbackError: Error {
    case downloadFailed
    case invalidURL
}
```

---

## 11. UI/UX Guidelines

### 11.1 Color Palette

```swift
extension Color {
    static let debatePrimary = Color("DebatePrimary") // #007AFF
    static let debateRecording = Color("DebateRecording") // #FF3B30
    static let debateSuccess = Color("DebateSuccess") // #34C759
    static let debateWarning = Color("DebateWarning") // #FF9500

    static let propTeam = Color("PropTeam") // Blue tint
    static let oppTeam = Color("OppTeam") // Red tint
}
```

### 11.2 Typography

```swift
extension Font {
    static let debateTitle = Font.system(size: 28, weight: .bold, design: .rounded)
    static let debateHeadline = Font.system(size: 20, weight: .semibold)
    static let debateBody = Font.system(size: 17, weight: .regular)
    static let debateCaption = Font.system(size: 13, weight: .regular)

    static let timerDisplay = Font.system(size: 64, weight: .light, design: .rounded)
}
```

### 11.3 Haptic Feedback

```swift
class HapticManager {
    static let shared = HapticManager()

    private let impact = UIImpactFeedbackGenerator(style: .medium)
    private let notification = UINotificationFeedbackGenerator()
    private let selection = UISelectionFeedbackGenerator()

    func notify() {
        notification.notificationOccurred(.success)
    }

    func warning() {
        notification.notificationOccurred(.warning)
    }

    func impact() {
        impact.impactOccurred()
    }

    func selection() {
        selection.selectionChanged()
    }
}
```

---

## 12. Error Handling

### 12.1 Error Types

```swift
enum AppError: LocalizedError {
    case networkError(Error)
    case apiError(statusCode: Int, message: String)
    case audioPermissionDenied
    case recordingFailed(Error)
    case uploadFailed(Error)
    case invalidDebateConfiguration
    case storageError(Error)

    var errorDescription: String? {
        switch self {
        case .networkError:
            return "Network connection error. Please check your internet connection."
        case .apiError(_, let message):
            return message
        case .audioPermissionDenied:
            return "Microphone access is required for recording. Please enable it in Settings."
        case .recordingFailed:
            return "Failed to record audio. Please try again."
        case .uploadFailed:
            return "Failed to upload recording. It will be retried automatically."
        case .invalidDebateConfiguration:
            return "Invalid debate setup. Please check all fields."
        case .storageError:
            return "Storage error. Please check available space."
        }
    }
}
```

### 12.2 Error Display

```swift
struct ErrorBanner: View {
    let error: AppError
    let onDismiss: () -> Void
    let onRetry: (() -> Void)?

    var body: some View {
        HStack {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundColor(.white)

            VStack(alignment: .leading) {
                Text("Error")
                    .font(.headline)
                Text(error.localizedDescription)
                    .font(.caption)
            }
            .foregroundColor(.white)

            Spacer()

            if let retry = onRetry {
                Button("Retry") {
                    retry()
                }
                .foregroundColor(.white)
            }

            Button(action: onDismiss) {
                Image(systemName: "xmark")
                    .foregroundColor(.white)
            }
        }
        .padding()
        .background(Color.red)
        .cornerRadius(8)
        .padding()
    }
}
```

---

## 13. Performance Requirements

### 13.1 Metrics

- **App Launch**: < 2 seconds cold start
- **Timer Accuracy**: ± 100ms
- **Recording Start Delay**: < 200ms from button press
- **Upload Initiation**: < 1 second after recording stops
- **UI Responsiveness**: 60 FPS animations
- **Memory Usage**: < 150 MB average
- **Audio File Size**: ~1 MB per minute (128 kbps)

### 13.2 Optimization Strategies

1. **Lazy Loading**: Load debate history on demand
2. **Image Caching**: Cache student avatars
3. **Background Upload**: Use `URLSession` background configuration
4. **Audio Compression**: Use AAC at 128 kbps
5. **Core Data Faulting**: Load relationships only when needed
6. **Debouncing**: Debounce search and filter inputs

---

## 14. Implementation Roadmap

### Phase 1: Core Setup (Week 1)
- [ ] Xcode project setup with SwiftUI
- [ ] Core Data model implementation
- [ ] File storage manager
- [ ] Basic navigation structure
- [ ] Authentication flow (guest + teacher)

### Phase 2: Debate Setup (Week 2)
- [ ] Motion input screen
- [ ] Student list management (manual + API)
- [ ] Team assignment with drag & drop
- [ ] Debate format configuration
- [ ] Validation logic

### Phase 3: Recording & Timer (Week 3)
- [ ] Timer implementation with bells
- [ ] AVAudioRecorder integration
- [ ] Recording UI with gestures
- [ ] Audio file management
- [ ] Interruption handling

### Phase 4: Upload & Sync (Week 4)
- [ ] API service layer
- [ ] Upload queue system
- [ ] Background upload tasks
- [ ] Retry logic
- [ ] Sync status UI

### Phase 5: Feedback System (Week 5)
- [ ] Polling manager
- [ ] Feedback display UI
- [ ] PDF download functionality
- [ ] Share sheet integration
- [ ] Guest mode archive

### Phase 6: Polish & Testing (Week 6)
- [ ] Error handling
- [ ] Haptic feedback
- [ ] Accessibility (VoiceOver)
- [ ] Performance optimization
- [ ] Integration testing
- [ ] User acceptance testing

---

## 15. Testing Strategy

### 15.1 Unit Tests
```swift
class AudioManagerTests: XCTestCase {
    func testRecordingStartsWithinTimeout() {
        let audioManager = AudioManager()
        let expectation = self.expectation(description: "Recording starts")

        try? audioManager.startRecording(for: mockDebate, speaker: mockSpeaker)

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
            XCTAssertTrue(audioManager.isRecording)
            expectation.fulfill()
        }

        waitForExpectations(timeout: 1.0)
    }
}
```

### 15.2 Integration Tests
- Test API communication
- Test upload queue functionality
- Test Core Data persistence
- Test offline behavior

### 15.3 UI Tests
- Test navigation flows
- Test timer accuracy
- Test drag & drop team assignment
- Test error states

---

## Key Implementation Notes

### Critical Success Factors
1. **Recording must ALWAYS work** - even without network
2. **Upload retry must be robust** - automatic with manual fallback
3. **Guest mode archive** - keep 2 entire debates (all speeches)
4. **Feedback download** - must support PDF export
5. **Timer accuracy** - bells at exact intervals with haptic feedback

### Development Environment Setup
1. Clone backend repository
2. Set up local development server
3. Configure `.xcconfig` with API endpoints
4. Add bell sound files to `Assets`
5. Create mock data for testing

### Next Steps
1. Review this specification
2. Set up Xcode project structure
3. Implement Core Data models
4. Build authentication flow
5. Implement debate setup screens
6. Integrate audio recording
7. Build upload system
8. Add feedback polling
9. Test end-to-end flow

---

**Document Version**: 2.0
**Last Updated**: October 24, 2025
**Status**: Ready for Implementation
