from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.update_board_request_estimation import UpdateBoardRequestEstimation
from ..models.update_board_request_swimlanes import UpdateBoardRequestSwimlanes
from ..types import UNSET, Unset
from typing import cast

if TYPE_CHECKING:
  from ..models.update_board_request_columns_item import UpdateBoardRequestColumnsItem
  from ..models.update_board_request_quick_filters_item import UpdateBoardRequestQuickFiltersItem





T = TypeVar("T", bound="UpdateBoardRequest")



@_attrs_define
class UpdateBoardRequest:
    """ 
        Attributes:
            name (str | Unset):
            query (str | Unset):
            swimlanes (UpdateBoardRequestSwimlanes | Unset):
            hide_done_after_days (int | None | Unset):
            estimation (UpdateBoardRequestEstimation | Unset):
            parallel_sprints (bool | Unset):
            columns (list[UpdateBoardRequestColumnsItem] | Unset):
            quick_filters (list[UpdateBoardRequestQuickFiltersItem] | Unset):
     """

    name: str | Unset = UNSET
    query: str | Unset = UNSET
    swimlanes: UpdateBoardRequestSwimlanes | Unset = UNSET
    hide_done_after_days: int | None | Unset = UNSET
    estimation: UpdateBoardRequestEstimation | Unset = UNSET
    parallel_sprints: bool | Unset = UNSET
    columns: list[UpdateBoardRequestColumnsItem] | Unset = UNSET
    quick_filters: list[UpdateBoardRequestQuickFiltersItem] | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.update_board_request_columns_item import UpdateBoardRequestColumnsItem # noqa: PLC0415
        from ..models.update_board_request_quick_filters_item import UpdateBoardRequestQuickFiltersItem # noqa: PLC0415
        name = self.name

        query = self.query

        swimlanes: str | Unset = UNSET
        if not isinstance(self.swimlanes, Unset):
            swimlanes = self.swimlanes.value


        hide_done_after_days: int | None | Unset
        if isinstance(self.hide_done_after_days, Unset):
            hide_done_after_days = UNSET
        else:
            hide_done_after_days = self.hide_done_after_days

        estimation: str | Unset = UNSET
        if not isinstance(self.estimation, Unset):
            estimation = self.estimation.value


        parallel_sprints = self.parallel_sprints

        columns: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.columns, Unset):
            columns = []
            for columns_item_data in self.columns:
                columns_item = columns_item_data.to_dict()
                columns.append(columns_item)



        quick_filters: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.quick_filters, Unset):
            quick_filters = []
            for quick_filters_item_data in self.quick_filters:
                quick_filters_item = quick_filters_item_data.to_dict()
                quick_filters.append(quick_filters_item)




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
        })
        if name is not UNSET:
            field_dict["name"] = name
        if query is not UNSET:
            field_dict["query"] = query
        if swimlanes is not UNSET:
            field_dict["swimlanes"] = swimlanes
        if hide_done_after_days is not UNSET:
            field_dict["hideDoneAfterDays"] = hide_done_after_days
        if estimation is not UNSET:
            field_dict["estimation"] = estimation
        if parallel_sprints is not UNSET:
            field_dict["parallelSprints"] = parallel_sprints
        if columns is not UNSET:
            field_dict["columns"] = columns
        if quick_filters is not UNSET:
            field_dict["quickFilters"] = quick_filters

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.update_board_request_columns_item import UpdateBoardRequestColumnsItem # noqa: PLC0415
        from ..models.update_board_request_quick_filters_item import UpdateBoardRequestQuickFiltersItem # noqa: PLC0415
        d = dict(src_dict)
        name = d.pop("name", UNSET)

        query = d.pop("query", UNSET)

        _swimlanes = d.pop("swimlanes", UNSET)
        swimlanes: UpdateBoardRequestSwimlanes | Unset
        if isinstance(_swimlanes,  Unset):
            swimlanes = UNSET
        else:
            swimlanes = UpdateBoardRequestSwimlanes(_swimlanes)




        def _parse_hide_done_after_days(data: object) -> int | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(int | None | Unset, data)

        hide_done_after_days = _parse_hide_done_after_days(d.pop("hideDoneAfterDays", UNSET))


        _estimation = d.pop("estimation", UNSET)
        estimation: UpdateBoardRequestEstimation | Unset
        if isinstance(_estimation,  Unset):
            estimation = UNSET
        else:
            estimation = UpdateBoardRequestEstimation(_estimation)




        parallel_sprints = d.pop("parallelSprints", UNSET)

        _columns = d.pop("columns", UNSET)
        columns: list[UpdateBoardRequestColumnsItem] | Unset = UNSET
        if _columns is not UNSET:
            columns = []
            for columns_item_data in _columns:
                columns_item = UpdateBoardRequestColumnsItem.from_dict(columns_item_data)



                columns.append(columns_item)


        _quick_filters = d.pop("quickFilters", UNSET)
        quick_filters: list[UpdateBoardRequestQuickFiltersItem] | Unset = UNSET
        if _quick_filters is not UNSET:
            quick_filters = []
            for quick_filters_item_data in _quick_filters:
                quick_filters_item = UpdateBoardRequestQuickFiltersItem.from_dict(quick_filters_item_data)



                quick_filters.append(quick_filters_item)


        update_board_request = cls(
            name=name,
            query=query,
            swimlanes=swimlanes,
            hide_done_after_days=hide_done_after_days,
            estimation=estimation,
            parallel_sprints=parallel_sprints,
            columns=columns,
            quick_filters=quick_filters,
        )


        update_board_request.additional_properties = d
        return update_board_request

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
