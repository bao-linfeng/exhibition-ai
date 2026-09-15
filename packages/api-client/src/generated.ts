export interface paths {
  '/api/health': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Process liveness. */
    get: operations['getHealth'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/ready': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description PostgreSQL, Redis and object storage readiness. */
    get: operations['getReadiness'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/auth/login': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Login with email and password. */
    post: operations['login'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/auth/me': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Get current user summary. */
    get: operations['getMe'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/auth/csrf': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Get CSRF token. */
    get: operations['getCsrf'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/auth/logout': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Logout current session. */
    post: operations['logout'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/auth/password': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    /** @description Change current user password. */
    put: operations['changePassword'];
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/auth/send-code': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Send an email verification code. */
    post: operations['sendVerificationCode'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/auth/register': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Register a user account. */
    post: operations['register'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/auth/forgot-password': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Reset a password with an email verification code. */
    post: operations['forgotPassword'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/users': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description List users (admin only). */
    get: operations['listUsers'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/users/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Get user details. */
    get: operations['getUser'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    /** @description Update user role/status (admin only). */
    patch: operations['updateUser'];
    trace?: never;
  };
  '/api/v1/users/options': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Get user options for member assignment. */
    get: operations['listUserOptions'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/customers': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description List customers with filtering. */
    get: operations['listCustomers'];
    put?: never;
    /** @description Create a new customer. */
    post: operations['createCustomer'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/customers/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Get customer details. */
    get: operations['getCustomer'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    /** @description Update customer details. */
    patch: operations['updateCustomer'];
    trace?: never;
  };
  '/api/v1/projects': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description List projects with filtering. */
    get: operations['listProjects'];
    put?: never;
    /** @description Create a new project. */
    post: operations['createProject'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/projects/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Get project details. */
    get: operations['getProject'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    /** @description Update project details. */
    patch: operations['updateProject'];
    trace?: never;
  };
  '/api/v1/projects/{id}/members': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description List project members. */
    get: operations['listProjectMembers'];
    put?: never;
    /** @description Add member to project. */
    post: operations['addProjectMember'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/projects/{id}/members/{userId}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    /** @description Remove member from project. */
    delete: operations['removeProjectMember'];
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/projects/{id}/transfer-owner': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Transfer project ownership. */
    post: operations['transferOwner'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/projects/{id}/transitions': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Transition project status. */
    post: operations['transitionProject'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/projects/{projectId}/brief': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Get current brief. */
    get: operations['getBrief'];
    /** @description Update brief and create new revision. */
    put: operations['updateBrief'];
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/projects/{projectId}/brief/revisions': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description List brief revision history. */
    get: operations['listBriefRevisions'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/projects/{projectId}/brief/revisions/{revisionId}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Get specific brief revision. */
    get: operations['getBriefRevision'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/projects/{projectId}/assets': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description List project assets. */
    get: operations['listAssets'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/projects/{projectId}/assets/uploads': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Create asset upload session. */
    post: operations['createUploadSession'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/projects/{projectId}/assets/uploads/{uploadId}/complete': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Complete asset upload and trigger validation. */
    post: operations['completeUpload'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/projects/{projectId}/assets/{assetId}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Get asset details. */
    get: operations['getAsset'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/projects/{projectId}/assets/{assetId}/download-url': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Create signed download URL for asset. */
    post: operations['createDownloadUrl'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/projects/{projectId}/generations': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Create image generation task. */
    post: operations['createGeneration'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/projects/{projectId}/versions': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description List image versions. */
    get: operations['listImageVersions'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/versions/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Get version details. */
    get: operations['getImageVersion'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/projects/{projectId}/selected-version': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    /** @description Select version as current. */
    put: operations['updateSelectedVersion'];
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/versions/{id}/hide': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Hide version from UI. */
    post: operations['hideVersion'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/projects/{projectId}/directions': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description List design directions. */
    get: operations['listDesignDirections'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/projects/{projectId}/directions/{directionId}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Get design direction details. */
    get: operations['getDesignDirection'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/tasks': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description List tasks with filtering. */
    get: operations['listTasks'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/tasks/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Get task details. */
    get: operations['getTask'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/tasks/{id}/cancel': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Cancel task. */
    post: operations['cancelTask'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/tasks/{id}/retry': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Retry failed task outputs. */
    post: operations['retryTask'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/tasks/{id}/reconcile': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Reconcile task output (admin only). */
    post: operations['reconcileTask'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/projects/{projectId}/conversation': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Get conversation for project. */
    get: operations['getConversation'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/projects/{projectId}/conversation/messages': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description List messages in conversation. */
    get: operations['listMessages'];
    put?: never;
    /** @description Send message to agent. */
    post: operations['sendMessage'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/confirmations/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Get confirmation details. */
    get: operations['getConfirmation'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/confirmations/{id}/approve': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Approve confirmation. */
    post: operations['approveConfirmation'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/confirmations/{id}/reject': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Reject confirmation. */
    post: operations['rejectConfirmation'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/projects/{projectId}/exports': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description List export history. */
    get: operations['listExports'];
    put?: never;
    /** @description Create export task. */
    post: operations['createExport'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/projects/{projectId}/exports/{exportId}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Get export details. */
    get: operations['getExport'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/audit-logs': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description List audit logs (admin only). */
    get: operations['listAuditLogs'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/models': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description List available AI models. */
    get: operations['listModelConfigs'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/projects/{projectId}/events': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Subscribe to project SSE events. */
    get: operations['subscribeProjectEvents'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/dashboard/summary': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Get the current user dashboard project summary. */
    get: operations['getDashboardSummary'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
}
export type webhooks = Record<string, never>;
export interface components {
  schemas: never;
  responses: never;
  parameters: never;
  requestBodies: never;
  headers: never;
  pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
  getHealth: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            /** @enum {string} */
            status: 'ok';
          };
        };
      };
    };
  };
  getReadiness: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            status: 'ready' | 'not_ready';
            dependencies: {
              postgres: boolean;
              redis: boolean;
              storage: boolean;
            };
          };
        };
      };
      /** @description Default Response */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            status: 'ready' | 'not_ready';
            dependencies: {
              postgres: boolean;
              redis: boolean;
              storage: boolean;
            };
          };
        };
      };
    };
  };
  login: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          /** Format: email */
          email: string;
          password: string;
        };
      };
    };
    responses: {
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            data: {
              /** Format: uuid */
              id: string;
              /** Format: email */
              email: string;
              displayName: string;
              role: 'admin' | 'designer' | 'sales' | 'viewer';
              status: 'enabled' | 'disabled';
              mustChangePassword: boolean;
              /** Format: date-time */
              createdAt: string;
            };
          };
        };
      };
      /** @description Default Response */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            error?: string;
            message?: string;
          };
        };
      };
    };
  };
  getMe: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            data: {
              /** Format: uuid */
              id: string;
              /** Format: email */
              email: string;
              displayName: string;
              role: 'admin' | 'designer' | 'sales' | 'viewer';
              status: 'enabled' | 'disabled';
              mustChangePassword: boolean;
              /** Format: date-time */
              createdAt: string;
            };
          };
        };
      };
      /** @description Default Response */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            error?: string;
            message?: string;
          };
        };
      };
    };
  };
  getCsrf: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            data: {
              token: string;
            };
          };
        };
      };
    };
  };
  logout: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description No content */
      204: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  changePassword: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          currentPassword: string;
          newPassword: string;
        };
      };
    };
    responses: {
      /** @description No content */
      204: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description Default Response */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            error?: string;
            message?: string;
          };
        };
      };
      /** @description Default Response */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            error?: string;
            message?: string;
          };
        };
      };
    };
  };
  sendVerificationCode: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          /** Format: email */
          email: string;
          type: 'register' | 'reset_password';
        };
      };
    };
    responses: {
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  register: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          /** Format: email */
          email: string;
          code: string;
          displayName: string;
          password: string;
        };
      };
    };
    responses: {
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            data: {
              /** Format: uuid */
              id: string;
              /** Format: email */
              email: string;
              displayName: string;
              role: 'admin' | 'designer' | 'sales' | 'viewer';
              status: 'enabled' | 'disabled';
              mustChangePassword: boolean;
              /** Format: date-time */
              createdAt: string;
            };
          };
        };
      };
    };
  };
  forgotPassword: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          /** Format: email */
          email: string;
          code: string;
          newPassword: string;
        };
      };
    };
    responses: {
      /** @description No content */
      204: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  listUsers: {
    parameters: {
      query?: {
        cursor?: string;
        limit?: number;
        role?: 'admin' | 'designer' | 'sales' | 'viewer';
        status?: 'enabled' | 'disabled';
        search?: string;
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            data: {
              /** Format: uuid */
              id: string;
              /** Format: email */
              email: string;
              displayName: string;
              role: 'admin' | 'designer' | 'sales' | 'viewer';
              status: 'enabled' | 'disabled';
              mustChangePassword: boolean;
              /** Format: date-time */
              createdAt: string;
              /** Format: date-time */
              updatedAt: string;
              revision: number;
            }[];
            page: {
              nextCursor: string | null;
              hasMore: boolean;
            };
          };
        };
      };
    };
  };
  getUser: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            data: {
              /** Format: uuid */
              id: string;
              /** Format: email */
              email: string;
              displayName: string;
              role: 'admin' | 'designer' | 'sales' | 'viewer';
              status: 'enabled' | 'disabled';
              mustChangePassword: boolean;
              /** Format: date-time */
              createdAt: string;
              /** Format: date-time */
              updatedAt: string;
              revision: number;
            };
          };
        };
      };
    };
  };
  updateUser: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          role?: 'admin' | 'designer' | 'sales' | 'viewer';
          status?: 'enabled' | 'disabled';
          expectedRevision: number;
        };
      };
    };
    responses: {
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            data: {
              /** Format: uuid */
              id: string;
              /** Format: email */
              email: string;
              displayName: string;
              role: 'admin' | 'designer' | 'sales' | 'viewer';
              status: 'enabled' | 'disabled';
              mustChangePassword: boolean;
              /** Format: date-time */
              createdAt: string;
              /** Format: date-time */
              updatedAt: string;
              revision: number;
            };
          };
        };
      };
    };
  };
  listUserOptions: {
    parameters: {
      query?: {
        search?: string;
        limit?: number;
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            data: {
              /** Format: uuid */
              id: string;
              displayName: string;
              email: string;
              role: 'admin' | 'designer' | 'sales' | 'viewer';
            }[];
          };
        };
      };
    };
  };
  listCustomers: {
    parameters: {
      query?: {
        cursor?: string;
        limit?: number;
        status?: 'active' | 'inactive';
        search?: string;
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            data: {
              /** Format: uuid */
              id: string;
              name: string;
              contactName?: string;
              contactPhone?: string;
              /** Format: email */
              contactEmail?: string;
              industry?: string;
              address?: string;
              notes?: string;
              status: 'active' | 'inactive';
              /** Format: uuid */
              createdBy: string;
              /** Format: date-time */
              createdAt: string;
              /** Format: date-time */
              updatedAt: string;
              revision: number;
            }[];
            page: {
              nextCursor: string | null;
              hasMore: boolean;
            };
          };
        };
      };
    };
  };
  createCustomer: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          name: string;
          contactName?: string;
          contactPhone?: string;
          /** Format: email */
          contactEmail?: string;
          industry?: string;
          address?: string;
          notes?: string;
        };
      };
    };
    responses: {
      /** @description Default Response */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            data: {
              /** Format: uuid */
              id: string;
              name: string;
              contactName?: string;
              contactPhone?: string;
              /** Format: email */
              contactEmail?: string;
              industry?: string;
              address?: string;
              notes?: string;
              status: 'active' | 'inactive';
              /** Format: uuid */
              createdBy: string;
              /** Format: date-time */
              createdAt: string;
              /** Format: date-time */
              updatedAt: string;
              revision: number;
            };
          };
        };
      };
    };
  };
  getCustomer: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            data: {
              /** Format: uuid */
              id: string;
              name: string;
              contactName?: string;
              contactPhone?: string;
              /** Format: email */
              contactEmail?: string;
              industry?: string;
              address?: string;
              notes?: string;
              status: 'active' | 'inactive';
              /** Format: uuid */
              createdBy: string;
              /** Format: date-time */
              createdAt: string;
              /** Format: date-time */
              updatedAt: string;
              revision: number;
            };
          };
        };
      };
    };
  };
  updateCustomer: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          name?: string;
          contactName?: string;
          contactPhone?: string;
          /** Format: email */
          contactEmail?: string;
          industry?: string;
          address?: string;
          notes?: string;
          status?: 'active' | 'inactive';
          expectedRevision: number;
        };
      };
    };
    responses: {
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            data: {
              /** Format: uuid */
              id: string;
              name: string;
              contactName?: string;
              contactPhone?: string;
              /** Format: email */
              contactEmail?: string;
              industry?: string;
              address?: string;
              notes?: string;
              status: 'active' | 'inactive';
              /** Format: uuid */
              createdBy: string;
              /** Format: date-time */
              createdAt: string;
              /** Format: date-time */
              updatedAt: string;
              revision: number;
            };
          };
        };
      };
    };
  };
  listProjects: {
    parameters: {
      query?: {
        cursor?: string;
        limit?: number;
        status?:
          | 'draft'
          | 'briefing'
          | 'designing'
          | 'reviewing'
          | 'approved'
          | 'archived';
        customerId?: string;
        ownerId?: string;
        search?: string;
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            data: {
              /** Format: uuid */
              id: string;
              name: string;
              /** Format: uuid */
              customerId: string;
              customerName: string;
              /** Format: uuid */
              ownerId: string;
              ownerName: string;
              status:
                | 'draft'
                | 'briefing'
                | 'designing'
                | 'reviewing'
                | 'approved'
                | 'archived';
              exhibitionName?: string;
              exhibitionDate?: string;
              deliveryDeadline?: string;
              /** Format: date-time */
              createdAt: string;
              /** Format: date-time */
              updatedAt: string;
            }[];
            page: {
              nextCursor: string | null;
              hasMore: boolean;
            };
          };
        };
      };
    };
  };
  createProject: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          name: string;
          /** Format: uuid */
          customerId: string;
          /** Format: uuid */
          ownerId: string;
          exhibitionName?: string;
          exhibitionVenue?: string;
          boothNumber?: string;
          exhibitionDate?: string;
          deliveryDeadline?: string;
          industry?: string;
          notes?: string;
        };
      };
    };
    responses: {
      /** @description Default Response */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            data: {
              /** Format: uuid */
              id: string;
              name: string;
              /** Format: uuid */
              customerId: string;
              customerName: string;
              /** Format: uuid */
              ownerId: string;
              ownerName: string;
              status:
                | 'draft'
                | 'briefing'
                | 'designing'
                | 'reviewing'
                | 'approved'
                | 'archived';
              archivedFromStatus:
                | (
                    | 'draft'
                    | 'briefing'
                    | 'designing'
                    | 'reviewing'
                    | 'approved'
                    | 'archived'
                  )
                | null;
              exhibitionName?: string;
              exhibitionVenue?: string;
              boothNumber?: string;
              exhibitionDate?: string;
              deliveryDeadline?: string;
              industry?: string;
              notes?: string;
              currentBriefRevisionId: string | null;
              selectedVersionId: string | null;
              nextVersionSequence: number;
              nextEventSequence: number;
              /** Format: date-time */
              createdAt: string;
              /** Format: date-time */
              updatedAt: string;
              revision: number;
            };
          };
        };
      };
    };
  };
  getProject: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            data: {
              /** Format: uuid */
              id: string;
              name: string;
              /** Format: uuid */
              customerId: string;
              customerName: string;
              /** Format: uuid */
              ownerId: string;
              ownerName: string;
              status:
                | 'draft'
                | 'briefing'
                | 'designing'
                | 'reviewing'
                | 'approved'
                | 'archived';
              archivedFromStatus:
                | (
                    | 'draft'
                    | 'briefing'
                    | 'designing'
                    | 'reviewing'
                    | 'approved'
                    | 'archived'
                  )
                | null;
              exhibitionName?: string;
              exhibitionVenue?: string;
              boothNumber?: string;
              exhibitionDate?: string;
              deliveryDeadline?: string;
              industry?: string;
              notes?: string;
              currentBriefRevisionId: string | null;
              selectedVersionId: string | null;
              nextVersionSequence: number;
              nextEventSequence: number;
              /** Format: date-time */
              createdAt: string;
              /** Format: date-time */
              updatedAt: string;
              revision: number;
            };
          };
        };
      };
    };
  };
  updateProject: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          name?: string;
          /** Format: uuid */
          ownerId?: string;
          exhibitionName?: string;
          exhibitionVenue?: string;
          boothNumber?: string;
          exhibitionDate?: string;
          deliveryDeadline?: string;
          industry?: string;
          notes?: string;
          expectedRevision: number;
        };
      };
    };
    responses: {
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            data: {
              /** Format: uuid */
              id: string;
              name: string;
              /** Format: uuid */
              customerId: string;
              customerName: string;
              /** Format: uuid */
              ownerId: string;
              ownerName: string;
              status:
                | 'draft'
                | 'briefing'
                | 'designing'
                | 'reviewing'
                | 'approved'
                | 'archived';
              archivedFromStatus:
                | (
                    | 'draft'
                    | 'briefing'
                    | 'designing'
                    | 'reviewing'
                    | 'approved'
                    | 'archived'
                  )
                | null;
              exhibitionName?: string;
              exhibitionVenue?: string;
              boothNumber?: string;
              exhibitionDate?: string;
              deliveryDeadline?: string;
              industry?: string;
              notes?: string;
              currentBriefRevisionId: string | null;
              selectedVersionId: string | null;
              nextVersionSequence: number;
              nextEventSequence: number;
              /** Format: date-time */
              createdAt: string;
              /** Format: date-time */
              updatedAt: string;
              revision: number;
            };
          };
        };
      };
    };
  };
  listProjectMembers: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            data: {
              /** Format: uuid */
              userId: string;
              userName: string;
              userEmail: string;
              userRole: string;
              /** Format: uuid */
              addedBy: string;
              /** Format: date-time */
              addedAt: string;
            }[];
          };
        };
      };
    };
  };
  addProjectMember: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          /** Format: uuid */
          userId: string;
        };
      };
    };
    responses: {
      /** @description Default Response */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            data: {
              /** Format: uuid */
              userId: string;
              userName: string;
              userEmail: string;
              userRole: string;
              /** Format: uuid */
              addedBy: string;
              /** Format: date-time */
              addedAt: string;
            };
          };
        };
      };
    };
  };
  removeProjectMember: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
        userId: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          expectedRevision: number;
        };
      };
    };
    responses: {
      /** @description No content */
      204: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  transferOwner: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          /** Format: uuid */
          userId: string;
          expectedRevision: number;
        };
      };
    };
    responses: {
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            data: {
              /** Format: uuid */
              id: string;
              name: string;
              /** Format: uuid */
              customerId: string;
              customerName: string;
              /** Format: uuid */
              ownerId: string;
              ownerName: string;
              status:
                | 'draft'
                | 'briefing'
                | 'designing'
                | 'reviewing'
                | 'approved'
                | 'archived';
              archivedFromStatus:
                | (
                    | 'draft'
                    | 'briefing'
                    | 'designing'
                    | 'reviewing'
                    | 'approved'
                    | 'archived'
                  )
                | null;
              exhibitionName?: string;
              exhibitionVenue?: string;
              boothNumber?: string;
              exhibitionDate?: string;
              deliveryDeadline?: string;
              industry?: string;
              notes?: string;
              currentBriefRevisionId: string | null;
              selectedVersionId: string | null;
              nextVersionSequence: number;
              nextEventSequence: number;
              /** Format: date-time */
              createdAt: string;
              /** Format: date-time */
              updatedAt: string;
              revision: number;
            };
          };
        };
      };
    };
  };
  transitionProject: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          action:
            | 'submit_review'
            | 'approve'
            | 'request_changes'
            | 'reopen'
            | 'archive'
            | 'restore';
          comment?: string;
          expectedRevision: number;
        };
      };
    };
    responses: {
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            data: {
              /** Format: uuid */
              id: string;
              name: string;
              /** Format: uuid */
              customerId: string;
              customerName: string;
              /** Format: uuid */
              ownerId: string;
              ownerName: string;
              status:
                | 'draft'
                | 'briefing'
                | 'designing'
                | 'reviewing'
                | 'approved'
                | 'archived';
              archivedFromStatus:
                | (
                    | 'draft'
                    | 'briefing'
                    | 'designing'
                    | 'reviewing'
                    | 'approved'
                    | 'archived'
                  )
                | null;
              exhibitionName?: string;
              exhibitionVenue?: string;
              boothNumber?: string;
              exhibitionDate?: string;
              deliveryDeadline?: string;
              industry?: string;
              notes?: string;
              currentBriefRevisionId: string | null;
              selectedVersionId: string | null;
              nextVersionSequence: number;
              nextEventSequence: number;
              /** Format: date-time */
              createdAt: string;
              /** Format: date-time */
              updatedAt: string;
              revision: number;
            };
          };
        };
      };
    };
  };
  getBrief: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            data: {
              /** Format: uuid */
              id: string;
              /** Format: uuid */
              projectId: string;
              number: number;
              content: {
                booth: {
                  widthM: number;
                  depthM: number;
                  heightLimitM: number;
                  openSides: ('front' | 'right' | 'back' | 'left')[];
                  hallRestrictions?: string;
                };
                brand: {
                  name: string;
                  primaryColor?: string;
                  secondaryColor?: string;
                  /** Format: uuid */
                  logoAssetId?: string;
                  visualKeywords?: string[];
                };
                functionalAreas: {
                  type:
                    | 'reception'
                    | 'meeting'
                    | 'display'
                    | 'storage'
                    | 'led'
                    | 'demo';
                  required: boolean;
                  quantity?: number;
                  description?: string;
                }[];
                style: {
                  keywords: string[];
                  materials?: string[];
                  forbiddenElements?: string[];
                };
                budget?: {
                  amountMinor: number;
                  /** @enum {string} */
                  currency: 'CNY';
                };
                deadline?: string;
                specialRequirements?: string;
              };
              /** Format: uuid */
              createdBy: string;
              /** Format: date-time */
              createdAt: string;
              confirmedBy: string | null;
              confirmedAt: string | null;
            } | null;
          };
        };
      };
    };
  };
  updateBrief: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          content: {
            booth: {
              widthM: number;
              depthM: number;
              heightLimitM: number;
              openSides: ('front' | 'right' | 'back' | 'left')[];
              hallRestrictions?: string;
            };
            brand: {
              name: string;
              primaryColor?: string;
              secondaryColor?: string;
              /** Format: uuid */
              logoAssetId?: string;
              visualKeywords?: string[];
            };
            functionalAreas: {
              type:
                | 'reception'
                | 'meeting'
                | 'display'
                | 'storage'
                | 'led'
                | 'demo';
              required: boolean;
              quantity?: number;
              description?: string;
            }[];
            style: {
              keywords: string[];
              materials?: string[];
              forbiddenElements?: string[];
            };
            budget?: {
              amountMinor: number;
              /** @enum {string} */
              currency: 'CNY';
            };
            deadline?: string;
            specialRequirements?: string;
          };
          expectedRevision: number;
        };
      };
    };
    responses: {
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            data: {
              /** Format: uuid */
              id: string;
              /** Format: uuid */
              projectId: string;
              number: number;
              content: {
                booth: {
                  widthM: number;
                  depthM: number;
                  heightLimitM: number;
                  openSides: ('front' | 'right' | 'back' | 'left')[];
                  hallRestrictions?: string;
                };
                brand: {
                  name: string;
                  primaryColor?: string;
                  secondaryColor?: string;
                  /** Format: uuid */
                  logoAssetId?: string;
                  visualKeywords?: string[];
                };
                functionalAreas: {
                  type:
                    | 'reception'
                    | 'meeting'
                    | 'display'
                    | 'storage'
                    | 'led'
                    | 'demo';
                  required: boolean;
                  quantity?: number;
                  description?: string;
                }[];
                style: {
                  keywords: string[];
                  materials?: string[];
                  forbiddenElements?: string[];
                };
                budget?: {
                  amountMinor: number;
                  /** @enum {string} */
                  currency: 'CNY';
                };
                deadline?: string;
                specialRequirements?: string;
              };
              /** Format: uuid */
              createdBy: string;
              /** Format: date-time */
              createdAt: string;
              confirmedBy: string | null;
              confirmedAt: string | null;
            };
          };
        };
      };
    };
  };
  listBriefRevisions: {
    parameters: {
      query?: {
        cursor?: string;
        limit?: number;
      };
      header?: never;
      path: {
        projectId: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            data: {
              /** Format: uuid */
              id: string;
              /** Format: uuid */
              projectId: string;
              number: number;
              content: {
                booth: {
                  widthM: number;
                  depthM: number;
                  heightLimitM: number;
                  openSides: ('front' | 'right' | 'back' | 'left')[];
                  hallRestrictions?: string;
                };
                brand: {
                  name: string;
                  primaryColor?: string;
                  secondaryColor?: string;
                  /** Format: uuid */
                  logoAssetId?: string;
                  visualKeywords?: string[];
                };
                functionalAreas: {
                  type:
                    | 'reception'
                    | 'meeting'
                    | 'display'
                    | 'storage'
                    | 'led'
                    | 'demo';
                  required: boolean;
                  quantity?: number;
                  description?: string;
                }[];
                style: {
                  keywords: string[];
                  materials?: string[];
                  forbiddenElements?: string[];
                };
                budget?: {
                  amountMinor: number;
                  /** @enum {string} */
                  currency: 'CNY';
                };
                deadline?: string;
                specialRequirements?: string;
              };
              /** Format: uuid */
              createdBy: string;
              /** Format: date-time */
              createdAt: string;
              confirmedBy: string | null;
              confirmedAt: string | null;
            }[];
            page: {
              nextCursor: string | null;
              hasMore: boolean;
            };
          };
        };
      };
    };
  };
  getBriefRevision: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: string;
        revisionId: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            data: {
              /** Format: uuid */
              id: string;
              /** Format: uuid */
              projectId: string;
              number: number;
              content: {
                booth: {
                  widthM: number;
                  depthM: number;
                  heightLimitM: number;
                  openSides: ('front' | 'right' | 'back' | 'left')[];
                  hallRestrictions?: string;
                };
                brand: {
                  name: string;
                  primaryColor?: string;
                  secondaryColor?: string;
                  /** Format: uuid */
                  logoAssetId?: string;
                  visualKeywords?: string[];
                };
                functionalAreas: {
                  type:
                    | 'reception'
                    | 'meeting'
                    | 'display'
                    | 'storage'
                    | 'led'
                    | 'demo';
                  required: boolean;
                  quantity?: number;
                  description?: string;
                }[];
                style: {
                  keywords: string[];
                  materials?: string[];
                  forbiddenElements?: string[];
                };
                budget?: {
                  amountMinor: number;
                  /** @enum {string} */
                  currency: 'CNY';
                };
                deadline?: string;
                specialRequirements?: string;
              };
              /** Format: uuid */
              createdBy: string;
              /** Format: date-time */
              createdAt: string;
              confirmedBy: string | null;
              confirmedAt: string | null;
            };
          };
        };
      };
    };
  };
  listAssets: {
    parameters: {
      query?: {
        cursor?: string;
        limit?: number;
        kind?:
          | 'logo'
          | 'product'
          | 'reference'
          | 'brand_material'
          | 'generated_image'
          | 'thumbnail'
          | 'export_zip';
        status?: 'pending' | 'validating' | 'ready' | 'rejected';
        includeHidden?: boolean;
      };
      header?: never;
      path: {
        projectId: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            data: {
              /** Format: uuid */
              id: string;
              /** Format: uuid */
              projectId: string;
              kind:
                | 'logo'
                | 'product'
                | 'reference'
                | 'brand_material'
                | 'generated_image'
                | 'thumbnail'
                | 'export_zip';
              status: 'pending' | 'validating' | 'ready' | 'rejected';
              bucket: string;
              objectKey: string;
              originalFilename: string;
              mimeType: string;
              sizeBytes: number;
              width: number | null;
              height: number | null;
              sha256: string | null;
              sourceAssetId: string | null;
              hiddenAt: string | null;
              /** Format: uuid */
              createdBy: string;
              /** Format: date-time */
              createdAt: string;
              /** Format: date-time */
              updatedAt: string;
            }[];
            page: {
              nextCursor: string | null;
              hasMore: boolean;
            };
          };
        };
      };
    };
  };
  createUploadSession: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          kind: 'logo' | 'product' | 'reference' | 'brand_material';
          originalFilename: string;
          sizeBytes: number;
          mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
        };
      };
    };
    responses: {
      /** @description Default Response */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            data: {
              /** Format: uuid */
              uploadId: string;
              /** Format: uri */
              url: string;
              requiredHeaders: {
                [key: string]: string;
              };
              /** Format: date-time */
              expiresAt: string;
            };
          };
        };
      };
    };
  };
  completeUpload: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: string;
        uploadId: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': Record<string, never>;
      };
    };
    responses: {
      /** @description Default Response */
      202: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            data: {
              /** Format: uuid */
              assetId: string;
              /** Format: uuid */
              validationTaskId: string;
            };
          };
        };
      };
    };
  };
  getAsset: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: string;
        assetId: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            data: {
              /** Format: uuid */
              id: string;
              /** Format: uuid */
              projectId: string;
              kind:
                | 'logo'
                | 'product'
                | 'reference'
                | 'brand_material'
                | 'generated_image'
                | 'thumbnail'
                | 'export_zip';
              status: 'pending' | 'validating' | 'ready' | 'rejected';
              bucket: string;
              objectKey: string;
              originalFilename: string;
              mimeType: string;
              sizeBytes: number;
              width: number | null;
              height: number | null;
              sha256: string | null;
              sourceAssetId: string | null;
              hiddenAt: string | null;
              /** Format: uuid */
              createdBy: string;
              /** Format: date-time */
              createdAt: string;
              /** Format: date-time */
              updatedAt: string;
            };
          };
        };
      };
    };
  };
  createDownloadUrl: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: string;
        assetId: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          variant?: 'original' | 'thumbnail';
        };
      };
    };
    responses: {
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            data: {
              /** Format: uri */
              url: string;
              /** Format: date-time */
              expiresAt: string;
            };
          };
        };
      };
    };
  };
  createGeneration: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json':
          | {
              /** @enum {string} */
              mode: 'generate';
              /** Format: uuid */
              briefRevisionId: string;
              /** Format: uuid */
              directionId: string;
              parentVersionId: null;
              inputAssetIds?: string[];
              instruction: string;
              /** Format: uuid */
              modelConfigId: string;
              parameters: {
                count?: number;
                sizePreset:
                  | 'landscape_4_3'
                  | 'landscape_16_9'
                  | 'square_1_1'
                  | 'portrait_3_4'
                  | 'portrait_9_16';
                seed?: number;
                negativePrompt?: string;
              };
              expectedProjectRevision: number;
            }
          | {
              /** @enum {string} */
              mode: 'edit';
              /** Format: uuid */
              briefRevisionId: string;
              /** Format: uuid */
              directionId?: string;
              /** Format: uuid */
              parentVersionId: string;
              inputAssetIds?: string[];
              instruction: string;
              /** Format: uuid */
              modelConfigId: string;
              parameters: {
                count?: number;
                sizePreset:
                  | 'landscape_4_3'
                  | 'landscape_16_9'
                  | 'square_1_1'
                  | 'portrait_3_4'
                  | 'portrait_9_16';
                seed?: number;
                negativePrompt?: string;
              };
              acknowledgeBriefChange?: boolean;
              expectedProjectRevision: number;
            };
      };
    };
    responses: {
      /** @description Default Response */
      202: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            data: {
              /** Format: uuid */
              taskId: string;
              /** @enum {string} */
              status: 'pending';
            };
          };
        };
      };
    };
  };
  listImageVersions: {
    parameters: {
      query?: {
        cursor?: string;
        limit?: number;
        parentVersionId?: string | 'root';
        briefRevisionId?: string;
      };
      header?: never;
      path: {
        projectId: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            data: {
              /** Format: uuid */
              id: string;
              /** Format: uuid */
              projectId: string;
              /** Format: uuid */
              assetId: string;
              parentVersionId: string | null;
              /** Format: uuid */
              taskId: string;
              outputOrdinal: number;
              sequence: number;
              /** Format: uuid */
              briefRevisionId: string;
              width: number;
              height: number;
              sizeBytes: number;
              mimeType: string;
              /** Format: uuid */
              createdBy: string;
              /** Format: date-time */
              createdAt: string;
            }[];
            page: {
              nextCursor: string | null;
              hasMore: boolean;
            };
          };
        };
      };
    };
  };
  getImageVersion: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            data: {
              /** Format: uuid */
              id: string;
              /** Format: uuid */
              projectId: string;
              /** Format: uuid */
              assetId: string;
              parentVersionId: string | null;
              /** Format: uuid */
              taskId: string;
              outputOrdinal: number;
              sequence: number;
              /** Format: uuid */
              briefRevisionId: string;
              width: number;
              height: number;
              sizeBytes: number;
              mimeType: string;
              /** Format: uuid */
              createdBy: string;
              /** Format: date-time */
              createdAt: string;
            };
          };
        };
      };
    };
  };
  updateSelectedVersion: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          versionId: string | null;
          expectedRevision: number;
        };
      };
    };
    responses: {
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            data: {
              selectedVersionId: string | null;
              revision: number;
            };
          };
        };
      };
    };
  };
  hideVersion: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          reason?: string;
        };
      };
    };
    responses: {
      /** @description Default Response */
      204: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  listDesignDirections: {
    parameters: {
      query?: {
        cursor?: string;
        limit?: number;
        briefRevisionId?: string;
      };
      header?: never;
      path: {
        projectId: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            data: {
              /** Format: uuid */
              id: string;
              /** Format: uuid */
              projectId: string;
              /** Format: uuid */
              briefRevisionId: string;
              /** Format: uuid */
              sourceTaskId: string;
              title: string;
              concept: string;
              layoutDescription: string;
              materialsAndColors: string;
              constraintsChecklist: string[];
              questionsForConfirmation?: string[];
              /** Format: uuid */
              createdBy: string;
              /** Format: date-time */
              createdAt: string;
            }[];
            page: {
              nextCursor: string | null;
              hasMore: boolean;
            };
          };
        };
      };
    };
  };
  getDesignDirection: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: string;
        directionId: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            data: {
              /** Format: uuid */
              id: string;
              /** Format: uuid */
              projectId: string;
              /** Format: uuid */
              briefRevisionId: string;
              /** Format: uuid */
              sourceTaskId: string;
              title: string;
              concept: string;
              layoutDescription: string;
              materialsAndColors: string;
              constraintsChecklist: string[];
              questionsForConfirmation?: string[];
              /** Format: uuid */
              createdBy: string;
              /** Format: date-time */
              createdAt: string;
            };
          };
        };
      };
    };
  };
  listTasks: {
    parameters: {
      query?: {
        cursor?: string;
        limit?: number;
        projectId?: string;
        kind?:
          | 'brief_parse'
          | 'design_direction'
          | 'image_generation'
          | 'asset_validation'
          | 'agent_run'
          | 'export';
        status?:
          | 'pending'
          | 'queued'
          | 'running'
          | 'awaiting_confirmation'
          | 'succeeded'
          | 'partially_succeeded'
          | 'failed'
          | 'cancelled'
          | 'reconciling';
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            data: {
              /** Format: uuid */
              id: string;
              /** Format: uuid */
              projectId: string;
              kind:
                | 'brief_parse'
                | 'design_direction'
                | 'image_generation'
                | 'asset_validation'
                | 'agent_run'
                | 'export';
              subtype: string | null;
              status:
                | 'pending'
                | 'queued'
                | 'running'
                | 'awaiting_confirmation'
                | 'succeeded'
                | 'partially_succeeded'
                | 'failed'
                | 'cancelled'
                | 'reconciling';
              stage: string | null;
              progress: number | null;
              outputs: {
                ordinal: number;
                state:
                  | 'pending'
                  | 'running'
                  | 'succeeded'
                  | 'failed'
                  | 'cancelled'
                  | 'reconciling';
                assetId: string | null;
                versionId: string | null;
                errorCode: string | null;
                errorMessage: string | null;
              }[];
              fee: {
                status: 'estimated' | 'actual' | 'unknown';
                amountMinor: number;
                currency: string;
                provider: string;
                model: string;
              } | null;
              errorCode: string | null;
              errorMessage: string | null;
              canCancel: boolean;
              canRetry: boolean;
              retryOfTaskId: string | null;
              /** Format: uuid */
              requestedBy: string;
              /** Format: date-time */
              createdAt: string;
              startedAt: string | null;
              finishedAt: string | null;
            }[];
            page: {
              nextCursor: string | null;
              hasMore: boolean;
            };
          };
        };
      };
    };
  };
  getTask: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            data: {
              /** Format: uuid */
              id: string;
              /** Format: uuid */
              projectId: string;
              kind:
                | 'brief_parse'
                | 'design_direction'
                | 'image_generation'
                | 'asset_validation'
                | 'agent_run'
                | 'export';
              subtype: string | null;
              status:
                | 'pending'
                | 'queued'
                | 'running'
                | 'awaiting_confirmation'
                | 'succeeded'
                | 'partially_succeeded'
                | 'failed'
                | 'cancelled'
                | 'reconciling';
              stage: string | null;
              progress: number | null;
              outputs: {
                ordinal: number;
                state:
                  | 'pending'
                  | 'running'
                  | 'succeeded'
                  | 'failed'
                  | 'cancelled'
                  | 'reconciling';
                assetId: string | null;
                versionId: string | null;
                errorCode: string | null;
                errorMessage: string | null;
              }[];
              fee: {
                status: 'estimated' | 'actual' | 'unknown';
                amountMinor: number;
                currency: string;
                provider: string;
                model: string;
              } | null;
              errorCode: string | null;
              errorMessage: string | null;
              canCancel: boolean;
              canRetry: boolean;
              retryOfTaskId: string | null;
              /** Format: uuid */
              requestedBy: string;
              /** Format: date-time */
              createdAt: string;
              startedAt: string | null;
              finishedAt: string | null;
            };
          };
        };
      };
    };
  };
  cancelTask: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            data: {
              status:
                | 'pending'
                | 'queued'
                | 'running'
                | 'awaiting_confirmation'
                | 'succeeded'
                | 'partially_succeeded'
                | 'failed'
                | 'cancelled'
                | 'reconciling';
              message: string;
            };
          };
        };
      };
    };
  };
  retryTask: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          failedOrdinals?: number[];
        };
      };
    };
    responses: {
      /** @description Default Response */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            data: {
              /** Format: uuid */
              taskId: string;
              /** @enum {string} */
              status: 'pending';
            };
          };
        };
      };
    };
  };
  reconcileTask: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          ordinal: number;
          outcome: 'succeeded' | 'failed' | 'cancelled';
          actualFee?: {
            status: 'estimated' | 'actual' | 'unknown';
            amountMinor: number;
            currency: string;
            provider: string;
            model: string;
          };
          reason: string;
        };
      };
    };
    responses: {
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            data: {
              /** Format: uuid */
              id: string;
              /** Format: uuid */
              projectId: string;
              kind:
                | 'brief_parse'
                | 'design_direction'
                | 'image_generation'
                | 'asset_validation'
                | 'agent_run'
                | 'export';
              subtype: string | null;
              status:
                | 'pending'
                | 'queued'
                | 'running'
                | 'awaiting_confirmation'
                | 'succeeded'
                | 'partially_succeeded'
                | 'failed'
                | 'cancelled'
                | 'reconciling';
              stage: string | null;
              progress: number | null;
              outputs: {
                ordinal: number;
                state:
                  | 'pending'
                  | 'running'
                  | 'succeeded'
                  | 'failed'
                  | 'cancelled'
                  | 'reconciling';
                assetId: string | null;
                versionId: string | null;
                errorCode: string | null;
                errorMessage: string | null;
              }[];
              fee: {
                status: 'estimated' | 'actual' | 'unknown';
                amountMinor: number;
                currency: string;
                provider: string;
                model: string;
              } | null;
              errorCode: string | null;
              errorMessage: string | null;
              canCancel: boolean;
              canRetry: boolean;
              retryOfTaskId: string | null;
              /** Format: uuid */
              requestedBy: string;
              /** Format: date-time */
              createdAt: string;
              startedAt: string | null;
              finishedAt: string | null;
            };
          };
        };
      };
    };
  };
  getConversation: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            data: {
              /** Format: uuid */
              id: string;
              /** Format: uuid */
              projectId: string;
              title: string;
              activeRunId: string | null;
              /** Format: date-time */
              createdAt: string;
              /** Format: date-time */
              updatedAt: string;
            };
          };
        };
      };
    };
  };
  listMessages: {
    parameters: {
      query?: {
        cursor?: string;
        limit?: number;
        before?: string;
      };
      header?: never;
      path: {
        projectId: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            data: {
              /** Format: uuid */
              id: string;
              /** Format: uuid */
              conversationId: string;
              role: 'user' | 'assistant' | 'system';
              parts: (
                | {
                    /** @enum {string} */
                    type: 'text';
                    text: string;
                  }
                | {
                    /** @enum {string} */
                    type: 'execution_summary';
                    summary: string;
                  }
                | {
                    /** @enum {string} */
                    type: 'tool';
                    toolName: string;
                    callId: string;
                    status: 'running' | 'succeeded' | 'failed';
                    summary: string;
                  }
                | {
                    /** @enum {string} */
                    type: 'asset';
                    /** Format: uuid */
                    assetId: string;
                  }
                | {
                    /** @enum {string} */
                    type: 'task';
                    /** Format: uuid */
                    taskId: string;
                  }
                | {
                    /** @enum {string} */
                    type: 'confirmation';
                    /** Format: uuid */
                    confirmationId: string;
                  }
                | {
                    /** @enum {string} */
                    type: 'error';
                    code: string;
                    message: string;
                  }
              )[];
              status:
                | 'pending'
                | 'streaming'
                | 'completed'
                | 'interrupted'
                | 'failed';
              clientMessageId: string | null;
              createdBy: string | null;
              /** Format: date-time */
              createdAt: string;
            }[];
            page: {
              nextCursor: string | null;
              hasMore: boolean;
            };
          };
        };
      };
    };
  };
  sendMessage: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          text: string;
          clientMessageId: string;
          assetIds?: string[];
        };
      };
    };
    responses: {
      /** @description Default Response */
      202: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            data: {
              /** Format: uuid */
              messageId: string;
              /** Format: uuid */
              runId: string;
              taskId: string | null;
            };
          };
        };
      };
    };
  };
  getConfirmation: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            data: {
              /** Format: uuid */
              id: string;
              /** Format: uuid */
              runId: string;
              /** Format: uuid */
              projectId: string;
              /** Format: uuid */
              requestedBy: string;
              action: 'apply_brief_patch' | 'create_generation';
              payload: {
                [key: string]: unknown;
              };
              payloadHash: string;
              estimatedFee?: {
                maxAmountMinor: number;
                currency: string;
              };
              status: 'pending' | 'approved' | 'rejected' | 'expired';
              resultTaskId: string | null;
              resultBriefRevisionId: string | null;
              /** Format: date-time */
              expiresAt: string;
              /** Format: date-time */
              createdAt: string;
            };
          };
        };
      };
    };
  };
  approveConfirmation: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          payloadHash: string;
        };
      };
    };
    responses: {
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            data: {
              /** Format: uuid */
              confirmationId: string;
              /** @enum {string} */
              status: 'approved';
              taskId: string | null;
              briefRevisionId: string | null;
            };
          };
        };
      };
    };
  };
  rejectConfirmation: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          reason?: string;
        };
      };
    };
    responses: {
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            data: {
              /** Format: uuid */
              confirmationId: string;
              /** @enum {string} */
              status: 'rejected';
            };
          };
        };
      };
    };
  };
  listExports: {
    parameters: {
      query?: {
        cursor?: string;
        limit?: number;
      };
      header?: never;
      path: {
        projectId: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            data: {
              /** Format: uuid */
              id: string;
              /** Format: uuid */
              projectId: string;
              /** @enum {string} */
              format: 'zip';
              versionIds: string[];
              status: 'pending' | 'queued' | 'running' | 'succeeded' | 'failed';
              resultAssetId: string | null;
              errorMessage: string | null;
              /** Format: uuid */
              createdBy: string;
              /** Format: date-time */
              createdAt: string;
              finishedAt: string | null;
            }[];
            page: {
              nextCursor: string | null;
              hasMore: boolean;
            };
          };
        };
      };
    };
  };
  createExport: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          versionIds: string[];
          /** @enum {string} */
          format?: 'zip';
        };
      };
    };
    responses: {
      /** @description Default Response */
      202: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            data: {
              /** Format: uuid */
              taskId: string;
              /** @enum {string} */
              status: 'pending';
            };
          };
        };
      };
    };
  };
  getExport: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: string;
        exportId: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            data: {
              /** Format: uuid */
              id: string;
              /** Format: uuid */
              projectId: string;
              /** @enum {string} */
              format: 'zip';
              versionIds: string[];
              status: 'pending' | 'queued' | 'running' | 'succeeded' | 'failed';
              resultAssetId: string | null;
              errorMessage: string | null;
              /** Format: uuid */
              createdBy: string;
              /** Format: date-time */
              createdAt: string;
              finishedAt: string | null;
            };
          };
        };
      };
    };
  };
  listAuditLogs: {
    parameters: {
      query?: {
        cursor?: string;
        limit?: number;
        eventType?:
          | 'user.login'
          | 'user.logout'
          | 'user.created'
          | 'user.updated'
          | 'project.created'
          | 'project.updated'
          | 'project.transitioned'
          | 'project.member_added'
          | 'project.member_removed'
          | 'project.owner_transferred'
          | 'brief.updated'
          | 'brief.confirmed'
          | 'generation.created'
          | 'task.cancelled'
          | 'task.reconciled'
          | 'asset.uploaded'
          | 'asset.hidden'
          | 'version.selected'
          | 'export.created';
        actorId?: string;
        projectId?: string;
        resourceType?: string;
        startDate?: string;
        endDate?: string;
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            data: {
              /** Format: uuid */
              id: string;
              eventType:
                | 'user.login'
                | 'user.logout'
                | 'user.created'
                | 'user.updated'
                | 'project.created'
                | 'project.updated'
                | 'project.transitioned'
                | 'project.member_added'
                | 'project.member_removed'
                | 'project.owner_transferred'
                | 'brief.updated'
                | 'brief.confirmed'
                | 'generation.created'
                | 'task.cancelled'
                | 'task.reconciled'
                | 'asset.uploaded'
                | 'asset.hidden'
                | 'version.selected'
                | 'export.created';
              actorId: string | null;
              actorEmail: string | null;
              projectId: string | null;
              resourceType: string | null;
              resourceId: string | null;
              metadata: {
                [key: string]: unknown;
              };
              ipAddress: string | null;
              userAgent: string | null;
              /** Format: date-time */
              createdAt: string;
            }[];
            page: {
              nextCursor: string | null;
              hasMore: boolean;
            };
          };
        };
      };
    };
  };
  listModelConfigs: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            data: {
              /** Format: uuid */
              id: string;
              providerId: string;
              modelId: string;
              displayName: string;
              description?: string;
              costPerImageMinor: number;
              currency: string;
              isActive: boolean;
            }[];
          };
        };
      };
    };
  };
  subscribeProjectEvents: {
    parameters: {
      query?: {
        after?: number;
      };
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Server-Sent Events stream */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': string;
        };
      };
    };
  };
  getDashboardSummary: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            totalProjects: number;
            activeProjects: number;
            pendingReview: number;
            approvedThisMonth: number;
            recentProjects: {
              /** Format: uuid */
              id: string;
              name: string;
              status:
                | 'draft'
                | 'briefing'
                | 'designing'
                | 'reviewing'
                | 'approved'
                | 'archived';
              customerName: string;
              /** Format: date-time */
              updatedAt: string;
            }[];
          };
        };
      };
    };
  };
}
