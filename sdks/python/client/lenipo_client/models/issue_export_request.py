from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.issue_export_request_columns_item_type_0 import IssueExportRequestColumnsItemType0
from ..models.issue_export_request_format import IssueExportRequestFormat
from ..types import UNSET, Unset
from typing import cast






T = TypeVar("T", bound="IssueExportRequest")



@_attrs_define
class IssueExportRequest:
    """ 
        Attributes:
            format_ (IssueExportRequestFormat):
            query (str | Unset):  Default: ''.
            columns (list[IssueExportRequestColumnsItemType0 | str] | Unset):
            headings (list[str] | Unset):
     """

    format_: IssueExportRequestFormat
    query: str | Unset = ''
    columns: list[IssueExportRequestColumnsItemType0 | str] | Unset = UNSET
    headings: list[str] | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        format_ = self.format_.value

        query = self.query

        columns: list[str] | Unset = UNSET
        if not isinstance(self.columns, Unset):
            columns = []
            for columns_item_data in self.columns:
                columns_item: str
                if isinstance(columns_item_data, IssueExportRequestColumnsItemType0):
                    columns_item = columns_item_data.value
                else:
                    columns_item = columns_item_data
                columns.append(columns_item)



        headings: list[str] | Unset = UNSET
        if not isinstance(self.headings, Unset):
            headings = self.headings




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "format": format_,
        })
        if query is not UNSET:
            field_dict["query"] = query
        if columns is not UNSET:
            field_dict["columns"] = columns
        if headings is not UNSET:
            field_dict["headings"] = headings

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        format_ = IssueExportRequestFormat(d.pop("format"))




        query = d.pop("query", UNSET)

        _columns = d.pop("columns", UNSET)
        columns: list[IssueExportRequestColumnsItemType0 | str] | Unset = UNSET
        if _columns is not UNSET:
            columns = []
            for columns_item_data in _columns:
                def _parse_columns_item(data: object) -> IssueExportRequestColumnsItemType0 | str:
                    try:
                        if not isinstance(data, str):
                            raise TypeError()
                        columns_item_type_0 = IssueExportRequestColumnsItemType0(data)



                        return columns_item_type_0
                    except (TypeError, ValueError, AttributeError, KeyError):
                        pass
                    return cast(IssueExportRequestColumnsItemType0 | str, data)

                columns_item = _parse_columns_item(columns_item_data)

                columns.append(columns_item)


        headings = cast(list[str], d.pop("headings", UNSET))


        issue_export_request = cls(
            format_=format_,
            query=query,
            columns=columns,
            headings=headings,
        )


        issue_export_request.additional_properties = d
        return issue_export_request

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
