from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.board_estimation import BoardEstimation
from ..models.board_swimlanes import BoardSwimlanes
from ..models.board_type import BoardType
from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.board_column import BoardColumn
  from ..models.board_project import BoardProject
  from ..models.quick_filter import QuickFilter





T = TypeVar("T", bound="Board")



@_attrs_define
class Board:
    """ 
        Attributes:
            id (UUID):
            name (str):
            type_ (BoardType):
            project (BoardProject):
            favourite (bool):
            query (str):
            swimlanes (BoardSwimlanes):
            hide_done_after_days (int | None):
            estimation (BoardEstimation):
            parallel_sprints (bool):
            columns (list[BoardColumn]):
            quick_filters (list[QuickFilter]):
            can_configure (bool):
     """

    id: UUID
    name: str
    type_: BoardType
    project: BoardProject
    favourite: bool
    query: str
    swimlanes: BoardSwimlanes
    hide_done_after_days: int | None
    estimation: BoardEstimation
    parallel_sprints: bool
    columns: list[BoardColumn]
    quick_filters: list[QuickFilter]
    can_configure: bool





    def to_dict(self) -> dict[str, Any]:
        from ..models.board_column import BoardColumn # noqa: PLC0415
        from ..models.board_project import BoardProject # noqa: PLC0415
        from ..models.quick_filter import QuickFilter # noqa: PLC0415
        id = str(self.id)

        name = self.name

        type_ = self.type_.value

        project = self.project.to_dict()

        favourite = self.favourite

        query = self.query

        swimlanes = self.swimlanes.value

        hide_done_after_days: int | None
        hide_done_after_days = self.hide_done_after_days

        estimation = self.estimation.value

        parallel_sprints = self.parallel_sprints

        columns = []
        for columns_item_data in self.columns:
            columns_item = columns_item_data.to_dict()
            columns.append(columns_item)



        quick_filters = []
        for quick_filters_item_data in self.quick_filters:
            quick_filters_item = quick_filters_item_data.to_dict()
            quick_filters.append(quick_filters_item)



        can_configure = self.can_configure


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "name": name,
            "type": type_,
            "project": project,
            "favourite": favourite,
            "query": query,
            "swimlanes": swimlanes,
            "hideDoneAfterDays": hide_done_after_days,
            "estimation": estimation,
            "parallelSprints": parallel_sprints,
            "columns": columns,
            "quickFilters": quick_filters,
            "canConfigure": can_configure,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.board_column import BoardColumn # noqa: PLC0415
        from ..models.board_project import BoardProject # noqa: PLC0415
        from ..models.quick_filter import QuickFilter # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        name = d.pop("name")

        type_ = BoardType(d.pop("type"))




        project = BoardProject.from_dict(d.pop("project"))




        favourite = d.pop("favourite")

        query = d.pop("query")

        swimlanes = BoardSwimlanes(d.pop("swimlanes"))




        def _parse_hide_done_after_days(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        hide_done_after_days = _parse_hide_done_after_days(d.pop("hideDoneAfterDays"))


        estimation = BoardEstimation(d.pop("estimation"))




        parallel_sprints = d.pop("parallelSprints")

        columns = []
        _columns = d.pop("columns")
        for columns_item_data in (_columns):
            columns_item = BoardColumn.from_dict(columns_item_data)



            columns.append(columns_item)


        quick_filters = []
        _quick_filters = d.pop("quickFilters")
        for quick_filters_item_data in (_quick_filters):
            quick_filters_item = QuickFilter.from_dict(quick_filters_item_data)



            quick_filters.append(quick_filters_item)


        can_configure = d.pop("canConfigure")

        board = cls(
            id=id,
            name=name,
            type_=type_,
            project=project,
            favourite=favourite,
            query=query,
            swimlanes=swimlanes,
            hide_done_after_days=hide_done_after_days,
            estimation=estimation,
            parallel_sprints=parallel_sprints,
            columns=columns,
            quick_filters=quick_filters,
            can_configure=can_configure,
        )

        return board

