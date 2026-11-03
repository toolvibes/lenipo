from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID






T = TypeVar("T", bound="ArrangeGadgetsRequest")



@_attrs_define
class ArrangeGadgetsRequest:
    """ 
        Attributes:
            columns (list[list[UUID]]):
     """

    columns: list[list[UUID]]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        columns = []
        for columns_item_data in self.columns:
            columns_item = []
            for columns_item_item_data in columns_item_data:
                columns_item_item = str(columns_item_item_data)
                columns_item.append(columns_item_item)


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
            columns_item = []
            _columns_item = columns_item_data
            for columns_item_item_data in (_columns_item):
                columns_item_item = UUID(columns_item_item_data)



                columns_item.append(columns_item_item)

            columns.append(columns_item)


        arrange_gadgets_request = cls(
            columns=columns,
        )


        arrange_gadgets_request.additional_properties = d
        return arrange_gadgets_request

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
