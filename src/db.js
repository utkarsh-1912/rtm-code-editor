const DatabaseClient = require('../server/repositories/DatabaseClient');
const UserRepository = require('../server/repositories/UserRepository');
const ProjectRepository = require('../server/repositories/ProjectRepository');
const RoomRepository = require('../server/repositories/RoomRepository');
const OrgRepository = require('../server/repositories/OrgRepository');
const SnippetRepository = require('../server/repositories/SnippetRepository');
const NotificationRepository = require('../server/repositories/NotificationRepository');
const DashboardRepository = require('../server/repositories/DashboardRepository');

module.exports = {
    // Database Connection & Schema
    sql: DatabaseClient.sql,
    initializeSchema: DatabaseClient.initializeSchema,

    // User Operations
    getUser: UserRepository.getUser,
    findOrCreateUser: UserRepository.findOrCreateUser,
    unsubscribeUser: UserRepository.unsubscribeUser,
    isUserUnsubscribed: UserRepository.isUserUnsubscribed,
    updateProfile: UserRepository.updateProfile,
    getSessions: UserRepository.getSessions,
    createSession: UserRepository.createSession,
    deleteOtherSessions: UserRepository.deleteOtherSessions,
    deleteAccount: UserRepository.deleteAccount,

    // Room Operations
    getRoom: RoomRepository.getRoom,
    saveRoom: RoomRepository.saveRoom,
    updateRoomCode: RoomRepository.updateRoomCode,
    updateRoomLanguage: RoomRepository.updateRoomLanguage,
    updateRoomChat: RoomRepository.updateRoomChat,
    updateRoomName: RoomRepository.updateRoomName,
    updateLastRoom: RoomRepository.updateLastRoom,
    linkRoomToUser: RoomRepository.linkRoomToUser,
    unlinkRoomFromUser: RoomRepository.unlinkRoomFromUser,
    isRoomGuest: RoomRepository.isRoomGuest,
    deleteRoomPermanently: RoomRepository.deleteRoomPermanently,

    // Organization Operations
    createOrganization: OrgRepository.createOrganization,
    getOrganizations: OrgRepository.getOrganizations,
    getOrgSnippets: OrgRepository.getOrgSnippets,
    addOrgMember: OrgRepository.addOrgMember,
    getOrgMembers: OrgRepository.getOrgMembers,
    deleteOrganization: OrgRepository.deleteOrganization,

    // Snippet Operations
    getSnippets: SnippetRepository.getSnippets,
    createSnippet: SnippetRepository.createSnippet,
    updateSnippet: SnippetRepository.updateSnippet,
    deleteSnippet: SnippetRepository.deleteSnippet,

    // Notification Operations
    getNotifications: NotificationRepository.getNotifications,
    createNotification: NotificationRepository.createNotification,
    markNotificationsRead: NotificationRepository.markNotificationsRead,
    clearNotifications: NotificationRepository.clearNotifications,
    deleteNotification: NotificationRepository.deleteNotification,

    // Dashboard & Search Operations
    getUserDashboard: DashboardRepository.getUserDashboard,
    searchAll: DashboardRepository.searchAll,

    // Project Operations
    createProject: ProjectRepository.createProject,
    getProjects: ProjectRepository.getProjects,
    getProject: ProjectRepository.getProject,
    getProjectFiles: ProjectRepository.getProjectFiles,
    upsertProjectFile: ProjectRepository.upsertProjectFile,
    deleteProjectFile: ProjectRepository.deleteProjectFile,
    deleteProject: ProjectRepository.deleteProject
};
