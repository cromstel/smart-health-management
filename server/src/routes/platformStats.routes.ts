import express from 'express'
import { getPlatformStatsHandler } from '../controllers/platformStats.controller'

const router = express.Router()

router.get('/', 
  // No auth required - public endpoint
  getPlatformStatsHandler
)

export default router