import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { FilesService } from './files.service';

@Controller('files')
export class FilesController {
  constructor(private files: FilesService) {}

  /** GET /api/files/textes/:name — official PDF of a text. */
  @Get('textes/:name')
  pdf(@Param('name') name: string, @Res() res: Response) {
    const found = this.files.locate(name);
    if (found.path) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline');
      return res.sendFile(found.path);
    }
    return res.redirect(302, found.redirect!);
  }
}
