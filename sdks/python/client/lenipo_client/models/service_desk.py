from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.request_type import RequestType
  from ..models.service_customer import ServiceCustomer
  from ..models.service_desk_settings import ServiceDeskSettings





T = TypeVar("T", bound="ServiceDesk")



@_attrs_define
class ServiceDesk:
    """ 
        Attributes:
            settings (ServiceDeskSettings):
            request_types (list[RequestType]):
            customers (list[ServiceCustomer]):
            portal_path (str):
     """

    settings: ServiceDeskSettings
    request_types: list[RequestType]
    customers: list[ServiceCustomer]
    portal_path: str





    def to_dict(self) -> dict[str, Any]:
        from ..models.request_type import RequestType # noqa: PLC0415
        from ..models.service_customer import ServiceCustomer # noqa: PLC0415
        from ..models.service_desk_settings import ServiceDeskSettings # noqa: PLC0415
        settings = self.settings.to_dict()

        request_types = []
        for request_types_item_data in self.request_types:
            request_types_item = request_types_item_data.to_dict()
            request_types.append(request_types_item)



        customers = []
        for customers_item_data in self.customers:
            customers_item = customers_item_data.to_dict()
            customers.append(customers_item)



        portal_path = self.portal_path


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "settings": settings,
            "requestTypes": request_types,
            "customers": customers,
            "portalPath": portal_path,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.request_type import RequestType # noqa: PLC0415
        from ..models.service_customer import ServiceCustomer # noqa: PLC0415
        from ..models.service_desk_settings import ServiceDeskSettings # noqa: PLC0415
        d = dict(src_dict)
        settings = ServiceDeskSettings.from_dict(d.pop("settings"))




        request_types = []
        _request_types = d.pop("requestTypes")
        for request_types_item_data in (_request_types):
            request_types_item = RequestType.from_dict(request_types_item_data)



            request_types.append(request_types_item)


        customers = []
        _customers = d.pop("customers")
        for customers_item_data in (_customers):
            customers_item = ServiceCustomer.from_dict(customers_item_data)



            customers.append(customers_item)


        portal_path = d.pop("portalPath")

        service_desk = cls(
            settings=settings,
            request_types=request_types,
            customers=customers,
            portal_path=portal_path,
        )

        return service_desk

