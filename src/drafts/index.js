import { markRaw } from 'vue'
import './drafts.css'
import SudokuDraft from './generators/SudokuDraft.vue'
import TspGraphDraft from './generators/TspGraphDraft.vue'
import NQueensDraft from './generators/NQueensDraft.vue'
import JobShopDraft from './generators/JobShopDraft.vue'
import BinPackingDraft from './generators/BinPackingDraft.vue'
import CvrpDraft from './generators/CvrpDraft.vue'
import VrptwDraft from './generators/VrptwDraft.vue'
import TspEdgesDraft from './generators/TspEdgesDraft.vue'
import TspMatrixDraft from './generators/TspMatrixDraft.vue'
import KnapsackDraft from './generators/KnapsackDraft.vue'
import DLogDraft from './generators/DLogDraft.vue'
import SubsetSumDraft from './generators/SubsetSumDraft.vue'

const withGroup = (group, items) => items.map((item) => ({ ...item, group }))

export const DRAFT_CHUNKS = [
  ...withGroup('Generators', [
    {
      id: 'sudoku-visual',
      title: 'Sudoku Solver',
      component: markRaw(SudokuDraft)
    },
    {
      id: 'tsp-graph',
      title: 'TSP (Interactive Graph)',
      component: markRaw(TspGraphDraft)
    },
    {
      id: 'n-queens',
      title: 'N-Queens Puzzle',
      component: markRaw(NQueensDraft)
    },
    {
      id: 'job-shop',
      title: 'Job Shop Scheduling',
      component: markRaw(JobShopDraft)
    },
    {
      id: 'bin-packing',
      title: 'Bin Packing / Allocation',
      component: markRaw(BinPackingDraft)
    },
    {
      id: 'cvrp-routing',
      title: 'Vehicle Routing (CVRP)',
      component: markRaw(CvrpDraft)
    },
    {
      id: 'vrptw-routing',
      title: 'Vehicle Routing + Time Windows (VRPTW)',
      component: markRaw(VrptwDraft)
    },
    {
      id: 'tsp-edges',
      title: 'TSP (Edge List)',
      component: markRaw(TspEdgesDraft)
    },
    {
      id: 'tsp-matrix',
      title: 'TSP (Distance Matrix)',
      component: markRaw(TspMatrixDraft)
    },
    {
      id: 'knapsack-01',
      title: '0-1 Knapsack',
      component: markRaw(KnapsackDraft)
    },
    {
      id: 'discrete-log',
      title: 'Discrete Logarithm',
      component: markRaw(DLogDraft)
    },
    {
      id: 'subset-sum',
      title: 'Subset Sum',
      component: markRaw(SubsetSumDraft)
    }
  ]),
  ...withGroup('Others', [])
]
