from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.issue_columns_columns_item_type_0 import IssueColumnsColumnsItemType0
from typing import cast






T = TypeVar("T", bound="IssueColumns")



@_attrs_define
class IssueColumns:
    """ 
        Attributes:
            columns (list[IssueColumnsColumnsItemType0 | str]):
     """

    columns: list[IssueColumnsColumnsItemType0 | str]





    def to_dict(self) -> dict[str, Any]:
        columns = []
        for columns_item_data in self.columns:
            columns_item: str
            if isinstance(columns_item_data, IssueColumnsColumnsItemType0):
                columns_item = columns_item_data.value
            else:
                columns_item = columns_item_data
            columns.append(columns_item)




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "columns": columns,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        columns = []
        _columns = d.pop("columns")
        for columns_item_data in (_columns):
            def _parse_columns_item(data: object) -> IssueColumnsColumnsItemType0 | str:
                try:
                    if not isinstance(data, str):
                        raise TypeError()
                    columns_item_type_0 = IssueColumnsColumnsItemType0(data)



                    return columns_item_type_0
                except (TypeError, ValueError, AttributeError, KeyError):
                    pass
                return cast(IssueColumnsColumnsItemType0 | str, data)

            columns_item = _parse_columns_item(columns_item_data)

            columns.append(columns_item)


        issue_columns = cls(
            columns=columns,
        )

        return issue_columns

