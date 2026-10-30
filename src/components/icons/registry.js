import React from "react";
// Glyphs come from Fluent UI System Icons (MIT). Each import is one icon's own module from
// the headless build, so the bundle only carries the icons listed here and no CSS-in-JS runtime.
// The unsized `…Regular` / `…Filled` exports are drawn on the 20px grid and scale with width/height.
import { AddFilled, AddRegular } from "@fluentui/react-icons/headless/svg/add";
import { ArrowLeftFilled, ArrowLeftRegular } from "@fluentui/react-icons/headless/svg/arrow-left";
import { ArrowDownloadFilled, ArrowDownloadRegular } from "@fluentui/react-icons/headless/svg/arrow-download";
import { ArrowMaximizeFilled, ArrowMaximizeRegular } from "@fluentui/react-icons/headless/svg/arrow-maximize";
import { ArrowMinimizeFilled, ArrowMinimizeRegular } from "@fluentui/react-icons/headless/svg/arrow-minimize";
import { ArrowResetFilled, ArrowResetRegular } from "@fluentui/react-icons/headless/svg/arrow-reset";
import { CalendarAddFilled, CalendarAddRegular } from "@fluentui/react-icons/headless/svg/calendar-add";
import { CallFilled, CallRegular } from "@fluentui/react-icons/headless/svg/call";
import { CallEndFilled, CallEndRegular } from "@fluentui/react-icons/headless/svg/call-end";
import { ChatFilled, ChatRegular } from "@fluentui/react-icons/headless/svg/chat";
import { CheckmarkFilled, CheckmarkRegular } from "@fluentui/react-icons/headless/svg/checkmark";
import { ChevronDownFilled, ChevronDownRegular } from "@fluentui/react-icons/headless/svg/chevron-down";
import { CodeFilled, CodeRegular } from "@fluentui/react-icons/headless/svg/code";
import { CopyFilled, CopyRegular } from "@fluentui/react-icons/headless/svg/copy";
import { DeleteFilled, DeleteRegular } from "@fluentui/react-icons/headless/svg/delete";
import { DocumentFilled, DocumentRegular } from "@fluentui/react-icons/headless/svg/document";
import { DocumentTextFilled, DocumentTextRegular } from "@fluentui/react-icons/headless/svg/document-text";
import { EraserFilled, EraserRegular } from "@fluentui/react-icons/headless/svg/eraser";
import { EyeFilled, EyeRegular } from "@fluentui/react-icons/headless/svg/eye";
import { EyeOffFilled, EyeOffRegular } from "@fluentui/react-icons/headless/svg/eye-off";
import { FolderFilled, FolderRegular } from "@fluentui/react-icons/headless/svg/folder";
import { FullScreenMaximizeFilled, FullScreenMaximizeRegular } from "@fluentui/react-icons/headless/svg/full-screen-maximize";
import { FullScreenMinimizeFilled, FullScreenMinimizeRegular } from "@fluentui/react-icons/headless/svg/full-screen-minimize";
import { GlobeFilled, GlobeRegular } from "@fluentui/react-icons/headless/svg/globe";
import { GridFilled, GridRegular } from "@fluentui/react-icons/headless/svg/grid";
import { LayoutCellFourFilled, LayoutCellFourRegular } from "@fluentui/react-icons/headless/svg/layout-cell-four";
import { HistoryFilled, HistoryRegular } from "@fluentui/react-icons/headless/svg/history";
import { MicFilled, MicRegular } from "@fluentui/react-icons/headless/svg/mic";
import { MicOffFilled, MicOffRegular } from "@fluentui/react-icons/headless/svg/mic-off";
import { MoreHorizontalFilled, MoreHorizontalRegular } from "@fluentui/react-icons/headless/svg/more-horizontal";
import { OpenFilled, OpenRegular } from "@fluentui/react-icons/headless/svg/open";
import { PanelLeftFilled, PanelLeftRegular } from "@fluentui/react-icons/headless/svg/panel-left";
import { PanelTopExpandFilled, PanelTopExpandRegular } from "@fluentui/react-icons/headless/svg/panel-top-expand";
import { PenFilled, PenRegular } from "@fluentui/react-icons/headless/svg/pen";
import { PersonFilled, PersonRegular } from "@fluentui/react-icons/headless/svg/person";
import { PictureInPictureFilled, PictureInPictureRegular } from "@fluentui/react-icons/headless/svg/picture-in-picture";
import { PinFilled, PinRegular } from "@fluentui/react-icons/headless/svg/pin";
import { PinOffFilled, PinOffRegular } from "@fluentui/react-icons/headless/svg/pin-off";
import { PlayFilled, PlayRegular } from "@fluentui/react-icons/headless/svg/play";
import { ReOrderDotsHorizontalFilled, ReOrderDotsHorizontalRegular } from "@fluentui/react-icons/headless/svg/re-order-dots-horizontal";
import { ScaleFillFilled, ScaleFillRegular } from "@fluentui/react-icons/headless/svg/scale-fill";
import { ScaleFitFilled, ScaleFitRegular } from "@fluentui/react-icons/headless/svg/scale-fit";
import { SearchFilled, SearchRegular } from "@fluentui/react-icons/headless/svg/search";
import { SettingsFilled, SettingsRegular } from "@fluentui/react-icons/headless/svg/settings";
import { ShareFilled, ShareRegular } from "@fluentui/react-icons/headless/svg/share";
import { ShareScreenStartFilled, ShareScreenStartRegular } from "@fluentui/react-icons/headless/svg/share-screen-start";
import { ShareScreenStopFilled, ShareScreenStopRegular } from "@fluentui/react-icons/headless/svg/share-screen-stop";
import { SubtractFilled, SubtractRegular } from "@fluentui/react-icons/headless/svg/subtract";
import { VideoFilled, VideoRegular } from "@fluentui/react-icons/headless/svg/video";
import { VideoOffFilled, VideoOffRegular } from "@fluentui/react-icons/headless/svg/video-off";
import { WeatherMoonFilled, WeatherMoonRegular } from "@fluentui/react-icons/headless/svg/weather-moon";
import { WeatherSunnyFilled, WeatherSunnyRegular } from "@fluentui/react-icons/headless/svg/weather-sunny";
import { WhiteboardFilled, WhiteboardRegular } from "@fluentui/react-icons/headless/svg/whiteboard";
import { WindowConsoleFilled, WindowConsoleRegular } from "@fluentui/react-icons/headless/svg/window-console";
import { ArrowClockwiseFilled, ArrowClockwiseRegular } from "@fluentui/react-icons/headless/svg/arrow-clockwise";
import { DesktopFilled, DesktopRegular } from "@fluentui/react-icons/headless/svg/desktop";
import { DismissFilled, DismissRegular } from "@fluentui/react-icons/headless/svg/dismiss";
import { ErrorCircleFilled, ErrorCircleRegular } from "@fluentui/react-icons/headless/svg/error-circle";
import { InfoFilled, InfoRegular } from "@fluentui/react-icons/headless/svg/info";
import { PanelLeftContractFilled, PanelLeftContractRegular } from "@fluentui/react-icons/headless/svg/panel-left-contract";
import { PhoneFilled, PhoneRegular } from "@fluentui/react-icons/headless/svg/phone";
import { TabletFilled, TabletRegular } from "@fluentui/react-icons/headless/svg/tablet";
import { WarningFilled, WarningRegular } from "@fluentui/react-icons/headless/svg/warning";
import { PeopleTeamAddFilled, PeopleTeamAddRegular } from "@fluentui/react-icons/headless/svg/people-team-add";
import { PeopleTeamFilled, PeopleTeamRegular } from "@fluentui/react-icons/headless/svg/people-team";
import { LinkFilled, LinkRegular } from "@fluentui/react-icons/headless/svg/link";
import { DataBarVerticalFilled, DataBarVerticalRegular } from "@fluentui/react-icons/headless/svg/data-bar-vertical";
import { TargetFilled, TargetRegular } from "@fluentui/react-icons/headless/svg/target";
import { HomeFilled, HomeRegular } from "@fluentui/react-icons/headless/svg/home";
import { SaveFilled, SaveRegular } from "@fluentui/react-icons/headless/svg/save";
import { DoorArrowRightFilled, DoorArrowRightRegular } from "@fluentui/react-icons/headless/svg/door-arrow-right";
import { CodeBlockFilled, CodeBlockRegular } from "@fluentui/react-icons/headless/svg/code-block";
import { DocumentAddFilled, DocumentAddRegular } from "@fluentui/react-icons/headless/svg/document-add";
import { FolderAddFilled, FolderAddRegular } from "@fluentui/react-icons/headless/svg/folder-add";
import { KeyCommandFilled, KeyCommandRegular } from "@fluentui/react-icons/headless/svg/key-command";
import { SendFilled, SendRegular } from "@fluentui/react-icons/headless/svg/send";
import { EmojiFilled, EmojiRegular } from "@fluentui/react-icons/headless/svg/emoji";
import { EditFilled, EditRegular } from "@fluentui/react-icons/headless/svg/edit";
import { ArrowUploadFilled, ArrowUploadRegular } from "@fluentui/react-icons/headless/svg/arrow-upload";
import { TableFilled, TableRegular } from "@fluentui/react-icons/headless/svg/table";
import { ClipboardPasteFilled, ClipboardPasteRegular } from "@fluentui/react-icons/headless/svg/clipboard-paste";
import { ReOrderDotsVerticalFilled, ReOrderDotsVerticalRegular } from "@fluentui/react-icons/headless/svg/re-order-dots-vertical";
import { BugFilled, BugRegular } from "@fluentui/react-icons/headless/svg/bug";
import { BeakerFilled, BeakerRegular } from "@fluentui/react-icons/headless/svg/beaker";
import { CheckmarkCircleFilled, CheckmarkCircleRegular } from "@fluentui/react-icons/headless/svg/checkmark-circle";
import { PauseFilled, PauseRegular } from "@fluentui/react-icons/headless/svg/pause";
import { TimerFilled, TimerRegular } from "@fluentui/react-icons/headless/svg/timer";
import { MusicNote1Filled, MusicNote1Regular } from "@fluentui/react-icons/headless/svg/music-note";
import { CodeTextFilled, CodeTextRegular } from "@fluentui/react-icons/headless/svg/code-text";
import { BookOpenFilled, BookOpenRegular } from "@fluentui/react-icons/headless/svg/book-open";
import { PanelLeftTextFilled, PanelLeftTextRegular } from "@fluentui/react-icons/headless/svg/panel-left-text";
import { LightbulbFilled, LightbulbRegular } from "@fluentui/react-icons/headless/svg/lightbulb";
import { WandFilled, WandRegular } from "@fluentui/react-icons/headless/svg/wand";
import { FlagFilled, FlagRegular } from "@fluentui/react-icons/headless/svg/flag";
import { NumberSymbolFilled, NumberSymbolRegular } from "@fluentui/react-icons/headless/svg/number-symbol";
import AiIcon from "./AiIcon";
import GitHubIcon from "./GitHubIcon";

const pair = (outline, filled) => ({ outline, filled });

// CoLabs brand icons: 24px grid, 1.75px stroke, round caps and joins, outline + filled.
// Sized 1em like the Fluent glyphs, so <Icon>'s font-size drives them too.
const AiOutline = (props) => <AiIcon size="1em" {...props} />;
const AiFilled = (props) => <AiIcon size="1em" {...props} filled />;
const GitHubOutline = (props) => <GitHubIcon size="1em" {...props} />;
const GitHubFilled = (props) => <GitHubIcon size="1em" {...props} filled />;

// One name per meaning. Add a name here before using a new glyph anywhere in the app,
// and reuse an existing name rather than registering a second glyph for the same idea.
const ICONS = {
    // Call
    mic: pair(MicRegular, MicFilled),
    "mic-off": pair(MicOffRegular, MicOffFilled),
    video: pair(VideoRegular, VideoFilled),
    "video-off": pair(VideoOffRegular, VideoOffFilled),
    "screen-share": pair(ShareScreenStartRegular, ShareScreenStartFilled),
    "screen-share-stop": pair(ShareScreenStopRegular, ShareScreenStopFilled),
    pin: pair(PinRegular, PinFilled),
    unpin: pair(PinOffRegular, PinOffFilled),
    call: pair(CallRegular, CallFilled),
    "calendar-add": pair(CalendarAddRegular, CalendarAddFilled),
    "call-leave": pair(CallEndRegular, CallEndFilled),
    draw: pair(PenRegular, PenFilled),
    erase: pair(EraserRegular, EraserFilled),

    // Call window and layout
    dock: pair(PanelLeftRegular, PanelLeftFilled),
    "pop-out": pair(PictureInPictureRegular, PictureInPictureFilled),
    "layout-grid": pair(GridRegular, GridFilled),
    "layout-speaker": pair(PanelTopExpandRegular, PanelTopExpandFilled),
    "scale-fill": pair(ScaleFillRegular, ScaleFillFilled),
    "scale-fit": pair(ScaleFitRegular, ScaleFitFilled),
    enlarge: pair(ArrowMaximizeRegular, ArrowMaximizeFilled),
    shrink: pair(ArrowMinimizeRegular, ArrowMinimizeFilled),
    "full-screen": pair(FullScreenMaximizeRegular, FullScreenMaximizeFilled),
    "exit-full-screen": pair(FullScreenMinimizeRegular, FullScreenMinimizeFilled),
    minimize: pair(SubtractRegular, SubtractFilled),
    collapse: pair(ChevronDownRegular, ChevronDownFilled),
    grip: pair(ReOrderDotsHorizontalRegular, ReOrderDotsHorizontalFilled),

    // Workspace
    whiteboard: pair(WhiteboardRegular, WhiteboardFilled),
    ai: pair(AiOutline, AiFilled),
    github: pair(GitHubOutline, GitHubFilled),
    spectator: pair(LinkRegular, LinkFilled),
    layout: pair(LayoutCellFourRegular, LayoutCellFourFilled),
    invite: pair(PeopleTeamAddRegular, PeopleTeamAddFilled),
    share: pair(ShareRegular, ShareFilled),
    history: pair(HistoryRegular, HistoryFilled),
    analytics: pair(DataBarVerticalRegular, DataBarVerticalFilled),
    focus: pair(TargetRegular, TargetFilled),
    palette: pair(KeyCommandRegular, KeyCommandFilled),
    search: pair(SearchRegular, SearchFilled),
    settings: pair(SettingsRegular, SettingsFilled),
    dashboard: pair(HomeRegular, HomeFilled),
    "leave-room": pair(DoorArrowRightRegular, DoorArrowRightFilled),
    back: pair(ArrowLeftRegular, ArrowLeftFilled),
    more: pair(MoreHorizontalRegular, MoreHorizontalFilled),
    run: pair(PlayRegular, PlayFilled),
    preview: pair(GlobeRegular, GlobeFilled),
    "open-external": pair(OpenRegular, OpenFilled),
    reload: pair(ArrowClockwiseRegular, ArrowClockwiseFilled),
    close: pair(DismissRegular, DismissFilled),
    "sidebar-close": pair(PanelLeftContractRegular, PanelLeftContractFilled),
    "device-desktop": pair(DesktopRegular, DesktopFilled),
    "device-tablet": pair(TabletRegular, TabletFilled),
    "device-phone": pair(PhoneRegular, PhoneFilled),
    "log-error": pair(ErrorCircleRegular, ErrorCircleFilled),
    "log-warn": pair(WarningRegular, WarningFilled),
    "log-info": pair(InfoRegular, InfoFilled),
    reset: pair(ArrowResetRegular, ArrowResetFilled),
    "theme-light": pair(WeatherSunnyRegular, WeatherSunnyFilled),
    "theme-dark": pair(WeatherMoonRegular, WeatherMoonFilled),
    show: pair(EyeRegular, EyeFilled),
    hide: pair(EyeOffRegular, EyeOffFilled),
    check: pair(CheckmarkRegular, CheckmarkFilled),
    add: pair(AddRegular, AddFilled),
    delete: pair(DeleteRegular, DeleteFilled),
    copy: pair(CopyRegular, CopyFilled),
    download: pair(ArrowDownloadRegular, ArrowDownloadFilled),
    snippet: pair(CodeBlockRegular, CodeBlockFilled),
    "save-disk": pair(SaveRegular, SaveFilled),
    "add-files": pair(DocumentAddRegular, DocumentAddFilled),

    // Panels and mobile tab bar
    file: pair(DocumentRegular, DocumentFilled),
    files: pair(FolderRegular, FolderFilled),
    "add-folder": pair(FolderAddRegular, FolderAddFilled),
    problem: pair(DocumentTextRegular, DocumentTextFilled),
    code: pair(CodeRegular, CodeFilled),
    terminal: pair(WindowConsoleRegular, WindowConsoleFilled),
    chat: pair(ChatRegular, ChatFilled),
    people: pair(PeopleTeamRegular, PeopleTeamFilled),
    person: pair(PersonRegular, PersonFilled),

    // Room tools: editor, chat, output, problem pane, layout menu, AI Copilot, focus mode
    send: pair(SendRegular, SendFilled),
    emoji: pair(EmojiRegular, EmojiFilled),
    edit: pair(EditRegular, EditFilled),
    upload: pair(ArrowUploadRegular, ArrowUploadFilled),
    table: pair(TableRegular, TableFilled),
    paste: pair(ClipboardPasteRegular, ClipboardPasteFilled),
    "grip-vertical": pair(ReOrderDotsVerticalRegular, ReOrderDotsVerticalFilled),
    bug: pair(BugRegular, BugFilled),
    tests: pair(BeakerRegular, BeakerFilled),
    success: pair(CheckmarkCircleRegular, CheckmarkCircleFilled),
    pause: pair(PauseRegular, PauseFilled),
    timer: pair(TimerRegular, TimerFilled),
    music: pair(MusicNote1Regular, MusicNote1Filled),
    starter: pair(CodeTextRegular, CodeTextFilled),
    read: pair(BookOpenRegular, BookOpenFilled),
    "layout-classic": pair(PanelLeftTextRegular, PanelLeftTextFilled),
    save: pair(SaveRegular, SaveFilled),
    explain: pair(LightbulbRegular, LightbulbFilled),
    refactor: pair(WandRegular, WandFilled),
    "room-id": pair(NumberSymbolRegular, NumberSymbolFilled),
    goal: pair(FlagRegular, FlagFilled),
    dropdown: pair(ChevronDownRegular, ChevronDownFilled),
};

export default ICONS;
