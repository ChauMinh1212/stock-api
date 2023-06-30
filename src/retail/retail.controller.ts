import { Controller, Get, HttpStatus, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { CatchException } from '../exceptions/common.exception';
import { BaseResponse } from '../utils/utils.response';
import { RetailValueDto } from './dto/retail-value.dto';
import { RetailValueSwagger } from './responses/retail-value.response';
import { RetailService } from './retail.service';

@Controller('retail')
@ApiTags('Retail')
export class RetailController {
  constructor(private readonly retailService: RetailService) {}

  @Get('ban-le-theo-nganh')
  @ApiOperation({
    summary: 'Giá trị bán lẻ theo các lĩnh vực (Tỷ VNĐ)',
  })
  @ApiResponse({type: RetailValueSwagger, status: HttpStatus.OK})
  async retailValue(@Query() q: RetailValueDto, @Res() res: Response) {
    try {
      const data = await this.retailService.retailValue(parseInt(q.order));
      return res.status(HttpStatus.OK).send(new BaseResponse({data}))
    } catch (error) {
      throw new CatchException(error)
    }
  }

  @Get('tang-truong-doanh-so-theo-nganh')
  @ApiOperation({
    summary: 'Tăng trưởng doanh số bán lẻ tại các lĩnh vực',
  })
  @ApiResponse({type: RetailValueSwagger, status: HttpStatus.OK})
  async retailPercentValue(@Query() q: RetailValueDto, @Res() res: Response) {
    try {
      const data = await this.retailService.retailPercentValue(parseInt(q.order));
      return res.status(HttpStatus.OK).send(new BaseResponse({data}))
    } catch (error) {
      throw new CatchException(error)
    }
  }

  @Get('tong-ban-le')
  @ApiOperation({
    summary: 'Bảng giá trị bán lẻ theo các tháng qua các lĩnh vực',
  })
  @ApiResponse({type: RetailValueSwagger, status: HttpStatus.OK})
  async retailValueTotal(@Res() res: Response) {
    try {
      const data = await this.retailService.retailValueTotal();
      return res.status(HttpStatus.OK).send(new BaseResponse({data}))
    } catch (error) {
      throw new CatchException(error)
    }
  }
}
