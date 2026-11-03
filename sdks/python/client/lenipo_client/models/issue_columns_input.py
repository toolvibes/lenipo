from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.issue_columns_input_columns_item_type_0 import IssueColumnsInputColumnsItemType0
from typing import cast






T = TypeVar("T", bound="IssueColumnsInput")



@_attrs_define
class IssueColumnsInput:
    """ 
        Attributes:
            columns (list[IssueColumnsInputColumnsItemType0 | str]):
     """

    columns: list[IssueColumnsInputColumnsItemType0 | str]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        columns = []
        for columns_item_data in self.columns:
            columns_item: str
            if isinstance(columns_item_data, IssueColumnsInputColumnsItemType0):
                columns_item = columns_item_data.value
            else:
                columns_item = columns_item_data
            columns.append(columns_item)




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
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
            def _parse_columns_item(data: object) -> IssueColumnsInputColumnsItemType0 | str:
                try:
                    if not isinstance(data, str):
                        raise TypeError()
                    columns_item_type_0 = IssueColumnsInputColumnsItemType0(data)



                    return columns_item_type_0
                except (TypeError, ValueError, AttributeError, KeyError):
                    pass
                return cast(IssueColumnsInputColumnsItemType0 | str, data)

            columns_item = _parse_columns_item(columns_item_data)

            columns.append(columns_item)


        issue_columns_input = cls(
            columns=columns,
        )


        issue_columns_input.additional_properties = d
        return issue_columns_input

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
