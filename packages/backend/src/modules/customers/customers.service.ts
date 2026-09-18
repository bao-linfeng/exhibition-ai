import type {
  CreateCustomerRequest,
  Customer as CustomerContract,
  CustomerStatus,
  UpdateCustomerRequest,
} from '@exhibition/contracts';
import type { Customer as DbCustomer } from '@exhibition/db';
import { CustomerRepository } from './customers.repository.js';

export class CustomerService {
  constructor(private repo: CustomerRepository) {}

  async listCustomers(
    query: {
      status?: CustomerStatus;
      search?: string;
      cursor?: string;
      limit?: number;
    },
    requestingUser: { id: string; role: string },
  ): Promise<
    | {
        data: CustomerContract[];
        page: { nextCursor: string | null; hasMore: boolean };
      }
    | 'forbidden'
  > {
    if (!['admin', 'designer', 'sales', 'viewer'].includes(requestingUser.role))
      return 'forbidden';

    const result = await this.repo.findAll({
      ...query,
      userId: requestingUser.id,
      userRole: requestingUser.role,
    });
    return {
      data: result.data.map((customer) => this.toCustomer(customer)),
      page: result.page,
    };
  }

  async createCustomer(
    data: CreateCustomerRequest,
    createdBy: string,
    requestingUser: { id: string; role: string },
  ): Promise<CustomerContract | 'forbidden'> {
    if (!['admin', 'sales'].includes(requestingUser.role)) return 'forbidden';

    return this.toCustomer(await this.repo.create({ ...data, createdBy }));
  }

  async getCustomer(
    id: string,
    requestingUser: { id: string; role: string },
  ): Promise<CustomerContract | null | 'forbidden'> {
    if (!['admin', 'designer', 'sales', 'viewer'].includes(requestingUser.role))
      return 'forbidden';

    const customer = await this.repo.findById(
      id,
      requestingUser.id,
      requestingUser.role,
    );
    return customer ? this.toCustomer(customer) : null;
  }

  async updateCustomer(
    id: string,
    data: UpdateCustomerRequest,
    expectedRevision: number,
    requestingUser: { id: string; role: string },
  ): Promise<CustomerContract | null | 'conflict' | 'forbidden'> {
    if (
      !['admin', 'sales'].includes(requestingUser.role) ||
      (data.status !== undefined && requestingUser.role !== 'admin')
    ) {
      return 'forbidden';
    }

    const customer = await this.repo.update(
      id,
      {
        name: data.name,
        contactName: data.contactName,
        contactPhone: data.contactPhone,
        contactEmail: data.contactEmail,
        industry: data.industry,
        address: data.address,
        notes: data.notes,
        status: data.status,
      },
      expectedRevision,
    );

    if (customer) return this.toCustomer(customer);
    return (await this.repo.findById(
      id,
      requestingUser.id,
      requestingUser.role,
    ))
      ? 'conflict'
      : null;
  }

  private toCustomer(customer: DbCustomer): CustomerContract {
    return {
      id: customer.id,
      name: customer.name,
      ...(customer.contactName ? { contactName: customer.contactName } : {}),
      ...(customer.contactPhone ? { contactPhone: customer.contactPhone } : {}),
      ...(customer.contactEmail ? { contactEmail: customer.contactEmail } : {}),
      ...(customer.industry ? { industry: customer.industry } : {}),
      ...(customer.address ? { address: customer.address } : {}),
      ...(customer.notes ? { notes: customer.notes } : {}),
      status: customer.status,
      createdBy: customer.createdBy,
      createdAt: customer.createdAt.toISOString(),
      updatedAt: customer.updatedAt.toISOString(),
      revision: customer.revision,
    };
  }
}
