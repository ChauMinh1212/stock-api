import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as moment from 'moment';
import { Repository } from 'typeorm';
import { DB_SERVER } from '../constants';
import { CatchException, ExceptionResponse } from '../exceptions/common.exception';
import { CreateWatchlistDto } from './dto/create-watchlist.dto';
import { UpdateWatchlistDto } from './dto/update-watchlist.dto';
import { WatchListEntity } from './entities/watchlist.entity';
import { GetAllWatchListResponse } from './responses/getAll.response';
import { WatchListDataResponse } from './responses/watchListData.response';

@Injectable()
export class WatchlistService {
  constructor(
    @InjectRepository(WatchListEntity, DB_SERVER) private readonly watchListRepo: Repository<WatchListEntity>
  ) { }

  async create(body: CreateWatchlistDto, user_id: number) {
    try {
      const new_watch_list = this.watchListRepo.create({
        name: body.name,
        code: JSON.stringify([]),
        user: {
          user_id
        }
      })

      await this.watchListRepo.save(new_watch_list)

      return {
        id: new_watch_list.id,
        name: new_watch_list.name
      }
    } catch (e) {
      throw new CatchException(e)
    }
  }

  async update(body: UpdateWatchlistDto, user_id: number) {
    try {
      const watch_list = await this.watchListRepo.findOne({ where: { id: body.id, user: { user_id } } })
      if (!watch_list) throw new ExceptionResponse(HttpStatus.BAD_REQUEST, 'Watchlist invalid')

      await this.watchListRepo.update({ id: body.id }, { name: body.name, code: JSON.stringify(body.code) })
    } catch (e) {
      throw new CatchException(e)
    }
  }

  async delete(id: number, user_id: number) {
    try {
      const watch_list = await this.watchListRepo.findOne({ where: { id, user: { user_id } } })
      if (!watch_list) throw new ExceptionResponse(HttpStatus.BAD_REQUEST, 'watch list invalid')

      await this.watchListRepo.delete({ id })
    } catch (e) {
      throw new CatchException(e)
    }
  }

  async getAll(user_id: number) {
    try {
      const watch_list = await this.watchListRepo.find({ where: { user: { user_id } } })
      return GetAllWatchListResponse.mapToList(watch_list)
    } catch (e) {
      throw new CatchException(e)
    }
  }

  queryDataWatchList(codes: string[]) {
    // return `
    // with temp as (
    //   select * from (select value, code, ratioCode from RATIO.dbo.ratio where code in (${codes.map(item => `'${item}'`).join(',')})
    //   and ratioCode in ('PRICE_LOWEST_CR_52W', 'PRICE_HIGHEST_CR_52W') and date = (select max(date) from RATIO.dbo.ratio where ratioCode = 'PRICE_HIGHEST_CR_52W')) as source pivot ( sum(value) for ratioCode in ([PRICE_LOWEST_CR_52W], [PRICE_HIGHEST_CR_52W]) ) as chuyen
    //   )
    //   select t.code, t.closePrice, i.floor, i.LV2, t.totalVol, t.totalVal, t.perChange,
    //          f.netVol as buyVol, f.netVal as buyVal,
    //          m.Mua, m.Ban, m.MB,
    //          r.PE, r.EPS, r.PB, r.BVPS, r.marketCap,
    //          c.ROE, c.ROA, c.grossProfitMargin as grossProfitMarginQuarter, c.netProfitMargin as netProfitMarginQuarter, y.grossProfitMargin as grossProfitMarginYear, y.netProfitMargin as netProfitMarginYear,
    //          n.ROE as ROENH, n.ROA as ROANH,
    //          p.PRICE_HIGHEST_CR_52W, p.PRICE_LOWEST_CR_52W
    //   from marketTrade.dbo.tickerTradeVND t
    //   inner join marketInfor.dbo.info i on i.code = t.code
    //   inner join marketTrade.dbo.[foreign] f on f.code = t.code
    //   inner join PHANTICH.dbo.MBChuDong m on m.MCK = t.code
    //   inner join RATIO.dbo.ratioInday r on r.code = t.code and r.date = t.date
    //   left join financialReport.dbo.calBCTC c on c.code = t.code and c.yearQuarter = (select max(yearQuarter) from financialReport.dbo.calBCTC)
    //   left join financialReport.dbo.calBCTC y on y.code = t.code and y.yearQuarter = (select max(yearQuarter) from financialReport.dbo.calBCTC where right(yearQuarter, 1) = 0)
    //   left join financialReport.dbo.calBCTCNH n on n.code = t.code and n.yearQuarter = (select max(yearQuarter) from financialReport.dbo.calBCTCNH)
    //   inner join temp p on p.code = t.code
    //   where t.code in (${codes.map(item => `'${item}'`).join(',')})
    //   and t.date = (select max(date) from marketTrade.dbo.tickerTradeVND)
    //   and m.Ngay = (select max(Ngay) from PHANTICH.dbo.MBChuDong)
    //   and f.date = (select max(date) from marketTrade.dbo.[foreign])
    // `
    const day_52_week = moment().subtract(52, 'week').format('YYYY-MM-DD')
    return `
    with min_max as (
      select code, min(closePrice) as PRICE_LOWEST_CR_52W, max(closePrice) as PRICE_HIGHEST_CR_52W from marketTrade.dbo.tickerTradeVND where code in (${codes.map(item => `'${item}'`).join(',')}) and date >= '${day_52_week}' group by code
    )
    select f.code, f.closePrice, f.floor, f.LV2, f.value as totalVal, f.volume as totalVol, f.beta,
    f.perChange1D as perChange, f.perChange5D as perChangeW, f.perChange1M as perChangeM,  f.perChange1Y as perChangeY,
    f.KNnetVal as buyVal, f.KNnetVol as buyVol,
    m.MB, m.Mua, m.Ban,
    f.PE, f.EPS, f.PB, f.BVPS, f.marketCap,
    f.TinHieuChiBaoKyThuat as tech, f.TinHieuDuongXuHuong as trend, f.TinHieuTongHop as overview,
    c.ROE, c.ROA, c.grossProfitMargin as grossProfitMarginQuarter, c.netProfitMargin as netProfitMarginQuarter, y.grossProfitMargin as grossProfitMarginYear, y.netProfitMargin as netProfitMarginYear,
    n.ROE as ROENH, n.ROA as ROANH,
    l.PRICE_HIGHEST_CR_52W, l.PRICE_LOWEST_CR_52W
     from VISUALIZED_DATA.dbo.filterResource f
     inner join PHANTICH.dbo.MBChuDong m on m.MCK = f.code and m.Ngay = (select max(Ngay) from PHANTICH.dbo.MBChuDong)
     left join financialReport.dbo.calBCTC c on c.code = f.code and c.yearQuarter = (select max(yearQuarter) from financialReport.dbo.calBCTC)
     left join financialReport.dbo.calBCTC y on y.code = f.code and y.yearQuarter = (select max(yearQuarter) from financialReport.dbo.calBCTC where right(yearQuarter, 1) = 0)
     left join financialReport.dbo.calBCTCNH n on n.code = f.code and n.yearQuarter = (select max(yearQuarter) from financialReport.dbo.calBCTCNH)
     left join min_max l on l.code = f.code
    where f.code in (${codes.map(item => `'${item}'`).join(',')})
      and f.date = (select max(date) from VISUALIZED_DATA.dbo.filterResource) 
    `
  }

  async watchListData(id: number, user_id: number) {
    try {
      const watch_list = await this.watchListRepo.findOne({ where: { id, user: { user_id } } })
      if (!watch_list) throw new ExceptionResponse(HttpStatus.BAD_REQUEST, 'watch list not found')

      const codes: string[] = JSON.parse(watch_list.code)
      if (codes.length === 0) return []

      const query = this.queryDataWatchList(codes)

      // const query_2 = `
      // with temp as (select code, closePrice,
      //         date,
      //         totalVal,
      //         DATEADD(MONTH, -1, date) as month, 
      //         DATEADD(WEEK, -1, date) as week, 
      //         DATEADD(YEAR, -1, date) as year,
      //         DATEFROMPARTS(YEAR(date) - 1, 12, 31) AS ytd
      // from marketTrade.dbo.tickerTradeVND
      // where code IN (${codes.map(item => `'${item}'`).join(',')})
      // ),
      // temp_2 as (SELECT
      //     code,
      //   closePrice,
      //   date,
      //   totalVal,
      //   lead(closePrice) over (partition by code order by date desc) as day,
      //   lead(date) over (partition by code order by date desc) as day_d,
      //   (select top 1 closePrice from marketTrade.dbo.tickerTradeVND where date = (select max(date) from marketTrade.dbo.tickerTradeVND where date <= week and type = 'STOCK') and code = temp.code) as week,
      //   (select max(date) from marketTrade.dbo.tickerTradeVND where date <= week and type = 'STOCK') as week_d,
      //   (select top 1 closePrice from marketTrade.dbo.tickerTradeVND where date = (select max(date) from marketTrade.dbo.tickerTradeVND where date <= month and type = 'STOCK') and code = temp.code) as month,
      //   (select max(date) from marketTrade.dbo.tickerTradeVND where date <= month and type = 'STOCK') as month_d,
      //   (select top 1 closePrice from marketTrade.dbo.tickerTradeVND where date = (select max(date) from marketTrade.dbo.tickerTradeVND where date <= year and type = 'STOCK') and code = temp.code) as year,
      //   (select max(date) from marketTrade.dbo.tickerTradeVND where date <= year and type = 'STOCK') as year_d,
      //   (select top 1 closePrice from marketTrade.dbo.tickerTradeVND where date = (select max(date) from marketTrade.dbo.tickerTradeVND where date <= ytd and type = 'STOCK') and code = temp.code) as ytd,
      //   (select max(date) from marketTrade.dbo.tickerTradeVND where date <= ytd and type = 'STOCK') as year_to_date_d
      // FROM
      //   temp)
      // select
      //     code,
      //     date,
      //     totalVal,
      //     closePrice as price,
      //         (closePrice - day) / day * 100 as day,
      //         (closePrice - week) / week * 100 as week,
      //         (closePrice - month) / month * 100 as month,
      //         (closePrice - year) / year * 100 as year,
      //         (closePrice - ytd) / ytd * 100 as ytd
      //         from temp_2 t
      //         where date = (select max(date) from temp_2)
      // `
        
      const data = await this.watchListRepo.query(query)
      return WatchListDataResponse.mapToList(data)
    } catch (e) {
      throw new CatchException(e)
    }
  }

  async watchListDataStock(code: string) {
    try {
      const query = this.queryDataWatchList([code])
      const data = await this.watchListRepo.query(query)
      return new WatchListDataResponse(data[0])
    } catch (e) {
      throw new CatchException(e)
    }
  }
}
