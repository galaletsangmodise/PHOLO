import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { PatientFileResponse, PatientRecord, PatientSearchItem } from '@pholo/types';
import type { AuthedRequest } from '../auth/auth.guard';
import { Authenticated, Roles } from '../auth/roles.decorator';
import { PatientsService } from './patients.service';

@Controller('patients')
export class PatientsController {
  constructor(private readonly patients: PatientsService) {}

  /** OP9 Search patients (BR13). Reception and Clinical (SEC24). */
  @Get()
  @Authenticated()
  @Roles('Reception', 'Clinical')
  search(@Req() request: AuthedRequest, @Query('q') q?: string): Promise<{ patients: PatientSearchItem[] }> {
    return this.patients.search(request.user!, q);
  }

  /** OP10 Get Patient File. Writes opened_patient_file. */
  @Get(':id')
  @Authenticated()
  @Roles('Reception', 'Clinical')
  getFile(@Req() request: AuthedRequest, @Param('id') id: string): Promise<PatientFileResponse> {
    return this.patients.getFile(request.user!, id);
  }

  /** OP11 Create patient. Reception only (SEC6, SEC24). */
  @Post()
  @HttpCode(201)
  @Authenticated()
  @Roles('Reception')
  create(@Req() request: AuthedRequest, @Body() body: unknown): Promise<PatientRecord> {
    return this.patients.create(request.user!, body);
  }

  /** OP12 Update patient details (SEC7, SEC24). */
  @Patch(':id')
  @Authenticated()
  @Roles('Reception', 'Clinical')
  update(@Req() request: AuthedRequest, @Param('id') id: string, @Body() body: unknown): Promise<PatientRecord> {
    return this.patients.update(request.user!, id, body);
  }
}
