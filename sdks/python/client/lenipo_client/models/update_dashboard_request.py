from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.dashboard_layout import DashboardLayout
from ..types import UNSET, Unset
from typing import cast

if TYPE_CHECKING:
  from ..models.filter_share_input_type_0 import FilterShareInputType0
  from ..models.filter_share_input_type_1 import FilterShareInputType1
  from ..models.filter_share_input_type_2 import FilterShareInputType2
  from ..models.filter_share_input_type_3 import FilterShareInputType3





T = TypeVar("T", bound="UpdateDashboardRequest")



@_attrs_define
class UpdateDashboardRequest:
    """ 
        Attributes:
            name (str | Unset):
            description (str | Unset):
            layout (DashboardLayout | Unset):
            shares (list[FilterShareInputType0 | FilterShareInputType1 | FilterShareInputType2 | FilterShareInputType3] |
                Unset):
     """

    name: str | Unset = UNSET
    description: str | Unset = UNSET
    layout: DashboardLayout | Unset = UNSET
    shares: list[FilterShareInputType0 | FilterShareInputType1 | FilterShareInputType2 | FilterShareInputType3] | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.filter_share_input_type_0 import FilterShareInputType0 # noqa: PLC0415
        from ..models.filter_share_input_type_1 import FilterShareInputType1 # noqa: PLC0415
        from ..models.filter_share_input_type_2 import FilterShareInputType2 # noqa: PLC0415
        from ..models.filter_share_input_type_3 import FilterShareInputType3 # noqa: PLC0415
        name = self.name

        description = self.description

        layout: str | Unset = UNSET
        if not isinstance(self.layout, Unset):
            layout = self.layout.value


        shares: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.shares, Unset):
            shares = []
            for shares_item_data in self.shares:
                shares_item: dict[str, Any]
                if isinstance(shares_item_data, FilterShareInputType0):
                    shares_item = shares_item_data.to_dict()
                elif isinstance(shares_item_data, FilterShareInputType1):
                    shares_item = shares_item_data.to_dict()
                elif isinstance(shares_item_data, FilterShareInputType2):
                    shares_item = shares_item_data.to_dict()
                else:
                    shares_item = shares_item_data.to_dict()

                shares.append(shares_item)




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
        })
        if name is not UNSET:
            field_dict["name"] = name
        if description is not UNSET:
            field_dict["description"] = description
        if layout is not UNSET:
            field_dict["layout"] = layout
        if shares is not UNSET:
            field_dict["shares"] = shares

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.filter_share_input_type_0 import FilterShareInputType0 # noqa: PLC0415
        from ..models.filter_share_input_type_1 import FilterShareInputType1 # noqa: PLC0415
        from ..models.filter_share_input_type_2 import FilterShareInputType2 # noqa: PLC0415
        from ..models.filter_share_input_type_3 import FilterShareInputType3 # noqa: PLC0415
        d = dict(src_dict)
        name = d.pop("name", UNSET)

        description = d.pop("description", UNSET)

        _layout = d.pop("layout", UNSET)
        layout: DashboardLayout | Unset
        if isinstance(_layout,  Unset):
            layout = UNSET
        else:
            layout = DashboardLayout(_layout)




        _shares = d.pop("shares", UNSET)
        shares: list[FilterShareInputType0 | FilterShareInputType1 | FilterShareInputType2 | FilterShareInputType3] | Unset = UNSET
        if _shares is not UNSET:
            shares = []
            for shares_item_data in _shares:
                def _parse_shares_item(data: object) -> FilterShareInputType0 | FilterShareInputType1 | FilterShareInputType2 | FilterShareInputType3:
                    try:
                        if not isinstance(data, dict):
                            raise TypeError()
                        componentsschemas_filter_share_input_type_0 = FilterShareInputType0.from_dict(data)



                        return componentsschemas_filter_share_input_type_0
                    except (TypeError, ValueError, AttributeError, KeyError):
                        pass
                    try:
                        if not isinstance(data, dict):
                            raise TypeError()
                        componentsschemas_filter_share_input_type_1 = FilterShareInputType1.from_dict(data)



                        return componentsschemas_filter_share_input_type_1
                    except (TypeError, ValueError, AttributeError, KeyError):
                        pass
                    try:
                        if not isinstance(data, dict):
                            raise TypeError()
                        componentsschemas_filter_share_input_type_2 = FilterShareInputType2.from_dict(data)



                        return componentsschemas_filter_share_input_type_2
                    except (TypeError, ValueError, AttributeError, KeyError):
                        pass
                    if not isinstance(data, dict):
                        raise TypeError()
                    componentsschemas_filter_share_input_type_3 = FilterShareInputType3.from_dict(data)



                    return componentsschemas_filter_share_input_type_3

                shares_item = _parse_shares_item(shares_item_data)

                shares.append(shares_item)


        update_dashboard_request = cls(
            name=name,
            description=description,
            layout=layout,
            shares=shares,
        )


        update_dashboard_request.additional_properties = d
        return update_dashboard_request

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
